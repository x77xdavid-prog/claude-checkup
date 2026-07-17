// DbAdapter의 Supabase 구현 (배포 필수 — 서버리스에서 요청 간 상태 영속화).
// 서버 전용: service_role 키로 접근하므로 절대 클라이언트 번들에 들어가면 안 된다
// (route/서버 컴포넌트에서만 import — 이 모듈은 "use client" 어디에서도 쓰지 말 것).
//
// 비즈니스 로직(총점 재계산 등)은 여기 없다 — route가 계산한 값을 그대로 영속화만 한다.
// 매핑: DB snake_case row ↔ 앱 camelCase record. 스키마 = supabase/migrations/0001_init.sql.

import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DbAdapter,
  ScanRecord,
  SubscriberRecord,
  SaveScanInput,
  SearchLogRecord,
  SearchLogInput,
  CliEventInput,
  FunnelEventInput,
  CreateApiKeyInput,
  ApiKeyRecord,
} from "./index";

// uuid v4 형식 검증 — 잘못된 id로 uuid 컬럼 조회 시 postgres 22P02 에러가 나므로 사전 차단.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/funnel-stats 조회 상한 — 초기 트래픽 규모(기간당 수천 건)엔 충분하다.
// 한계: 이 상한에 도달하면(트래픽 급증 등) 가장 오래된 초과분이 조용히 누락된다 — 그 시점엔 커서 페이지네이션으로 전환할 것.
const FUNNEL_EVENTS_LIMIT = 10000;

// 서버리스 인스턴스당 클라이언트 1개 재사용(dev HMR 대비 globalThis 고정).
type G = { __checkupSb?: SupabaseClient };
function client(): SupabaseClient {
  const g = globalThis as unknown as G;
  if (g.__checkupSb) return g.__checkupSb;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    // selectAdapter가 supabase를 고른 뒤에만 이 모듈이 호출되므로 여기 도달 = 설정 불일치.
    throw new Error("Supabase 설정 누락: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }, // 서버·service_role = 세션 불필요
  });
  g.__checkupSb = sb;
  return sb;
}

// ── row → record 매퍼 (순수 함수 — 자가검증 대상) ──────────────────────────────

type ScanRow = { id: string; created_at: string; score_total: number; categories: unknown; meta: unknown };
type SubRow = { email: string; created_at: string; confirmed: boolean; unsub_token: string };
type LogRow = { created_at: string; query: string; matched_usecase: string | null; result_count: number };
type ApiKeyRow = { tier: string; revoked: boolean; paid_until: string | null };

export function mapScan(r: ScanRow): ScanRecord {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    scoreTotal: r.score_total,
    categories: r.categories as ScanRecord["categories"],
    meta: r.meta as ScanRecord["meta"],
  };
}

export function mapSub(r: SubRow): SubscriberRecord {
  return {
    email: r.email,
    createdAt: new Date(r.created_at).toISOString(),
    confirmed: r.confirmed,
    unsubToken: r.unsub_token,
  };
}

export function mapLog(r: LogRow): SearchLogRecord {
  return {
    createdAt: new Date(r.created_at).toISOString(),
    query: r.query,
    matchedUsecase: r.matched_usecase,
    resultCount: r.result_count,
  };
}

// tier는 DB에서 check 제약으로 'free'|'paid'만 들어오지만, 방어적으로 'paid'가 아니면 free로 좁힌다.
export function mapApiKey(r: ApiKeyRow): ApiKeyRecord {
  return {
    tier: r.tier === "paid" ? "paid" : "free",
    revoked: r.revoked,
    paidUntil: r.paid_until,
  };
}

// ── 어댑터 ─────────────────────────────────────────────────────────────────────

export const supabaseDb: DbAdapter = {
  async saveScan(input: SaveScanInput): Promise<ScanRecord> {
    const { data, error } = await client()
      .from("scans")
      .insert({ score_total: input.scoreTotal, categories: input.categories, meta: input.meta })
      .select()
      .single();
    if (error || !data) throw new Error("saveScan 실패: " + (error?.message ?? "빈 응답"));
    return mapScan(data as ScanRow);
  },

  // 없거나 잘못된 id면 null(=결과 만료 UI). DB 에러는 서버 로그 남기고 null로 폴백(페이지 크래시 방지).
  async getScan(id: string): Promise<ScanRecord | null> {
    if (!UUID_RE.test(id)) return null;
    const { data, error } = await client().from("scans").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("getScan DB 에러:", error.message);
      return null;
    }
    return data ? mapScan(data as ScanRow) : null;
  },

  // 멱등: 이미 있으면 기존 반환(created=false). unique 충돌(23505)을 신규 경로와 구분.
  async addSubscriber(email: string): Promise<{ record: SubscriberRecord; created: boolean }> {
    const { data, error } = await client().from("subscribers").insert({ email }).select().single();
    if (!error && data) return { record: mapSub(data as SubRow), created: true };
    if (error && error.code === "23505") {
      const { data: existing, error: e2 } = await client()
        .from("subscribers")
        .select("*")
        .eq("email", email)
        .single();
      if (e2 || !existing) throw new Error("addSubscriber 재조회 실패: " + (e2?.message ?? "빈 응답"));
      return { record: mapSub(existing as SubRow), created: false };
    }
    throw new Error("addSubscriber 실패: " + (error?.message ?? "빈 응답"));
  },

  async listSubscribers(): Promise<SubscriberRecord[]> {
    const { data, error } = await client().from("subscribers").select("*").order("created_at", { ascending: true });
    if (error) throw new Error("listSubscribers 실패: " + error.message);
    return (data ?? []).map((r) => mapSub(r as SubRow));
  },

  // 이중 옵트인 확인 — unsub_token으로 confirmed=true 갱신. 없거나 잘못된 토큰이면 {ok:false}(사용자 열거 방지).
  // unsub_token은 uuid 컬럼 → 비-uuid를 eq에 넘기면 22P02가 나므로 getScan과 동일하게 UUID_RE로 사전 차단.
  // DB 에러도 throw 대신 로그+{ok:false}(route가 500나지 않게 — getScan/logSearch와 동일 계약).
  async confirmSubscriber(token: string): Promise<{ ok: boolean; email?: string }> {
    if (typeof token !== "string" || !UUID_RE.test(token)) return { ok: false };
    const { data, error } = await client()
      .from("subscribers")
      .update({ confirmed: true })
      .eq("unsub_token", token)
      .select("email")
      .maybeSingle();
    if (error) {
      console.error("confirmSubscriber DB 에러:", error.message);
      return { ok: false };
    }
    return data ? { ok: true, email: (data as { email: string }).email } : { ok: false };
  },

  // 수신거부 — unsub_token으로 행 삭제(GDPR clean). 삭제된 행 유무로 ok 판정(.select()로 반환받음).
  // 없거나 잘못된 토큰 → {ok:false}. 재클릭(이미 삭제)도 {ok:false}지만 route가 멱등하게 처리한다.
  async unsubscribe(token: string): Promise<{ ok: boolean }> {
    if (typeof token !== "string" || !UUID_RE.test(token)) return { ok: false };
    const { data, error } = await client().from("subscribers").delete().eq("unsub_token", token).select("email");
    if (error) {
      console.error("unsubscribe DB 에러:", error.message);
      return { ok: false };
    }
    return { ok: Array.isArray(data) && data.length > 0 };
  },

  // fire-and-forget: 실패해도 throw 안 함(검색 UX 영향 없게 — memory 어댑터와 동일 계약).
  async logSearch(input: SearchLogInput): Promise<void> {
    const { error } = await client()
      .from("search_logs")
      .insert({ query: input.query, matched_usecase: input.matchedUsecase, result_count: input.resultCount });
    if (error) console.error("logSearch 실패(무시):", error.message);
  },

  async listSearchLogs(): Promise<SearchLogRecord[]> {
    const { data, error } = await client().from("search_logs").select("*").order("created_at", { ascending: true });
    if (error) throw new Error("listSearchLogs 실패: " + error.message);
    return (data ?? []).map((r) => mapLog(r as LogRow));
  },

  // CLI 텔레메트리 — fire-and-forget: 실패해도 throw 안 함(route가 이걸로 500나면 안 됨, logSearch와 동일 계약).
  // created_at은 DB default now()에 위임(클라이언트 ts는 route에서 검증만 하고 여기 넘어오지 않음).
  async logCliEvent(input: CliEventInput): Promise<void> {
    const { error } = await client()
      .from("cli_events")
      .insert({ event: input.event, value: input.value, cli_version: input.cliVersion, locale: input.locale });
    if (error) console.error("logCliEvent 실패(무시):", error.message);
  },

  // 웹 퍼널 복사 이벤트 — 별도 테이블 없이 cli_events 재사용(event=web_*, cli_version="web"로 소스 구분).
  // value는 NOT NULL이므로 name이 없으면 ""로 저장. fire-and-forget: 실패해도 throw 안 함(route가 이걸로 500나면 안 됨).
  // 테이블이 없어도(마이그레이션 미적용) throw 대신 로그만 남긴다 → route는 항상 200(graceful degradation).
  async logFunnelEvent(input: FunnelEventInput): Promise<void> {
    const { error } = await client()
      .from("cli_events")
      .insert({ event: input.event, value: input.name ?? "", cli_version: "web", locale: input.locale });
    if (error) console.error("logFunnelEvent 실패(무시):", error.message);
  },

  // 웹 퍼널 통계 조회(GET /api/funnel-stats) — event·value만 읽는다(PII 없음, created_at도 select하지 않음).
  // 읽기 실패는 throw(listSearchLogs/listSubscribers와 동일 계약) — route가 잡아서 500으로 변환한다.
  async listFunnelEvents(sinceIso: string): Promise<Array<{ event: string; value: string }>> {
    const { data, error } = await client()
      .from("cli_events")
      .select("event,value")
      .eq("cli_version", "web")
      .gte("created_at", sinceIso)
      .limit(FUNNEL_EVENTS_LIMIT);
    if (error) throw new Error("listFunnelEvents 실패: " + error.message);
    return (data ?? []) as Array<{ event: string; value: string }>;
  },

  // 무료 키 발급 — 원문 미저장(key_hash=sha256만). tier/verified/revoked는 DB default에 위임.
  // 실패(테이블 미존재 포함)는 throw → route가 500으로 변환(발급은 실패를 감추면 안 됨, 검증 경로와 다름).
  async createApiKey(input: CreateApiKeyInput): Promise<void> {
    const { error } = await client().from("api_keys").insert({ key_hash: input.keyHash, email: input.email });
    if (error) throw new Error("createApiKey 실패: " + error.message);
  },

  // 키 조회(MCP 티어 분기) — 없거나 테이블 미존재/DB 에러면 null(익명 티어 폴백, MCP 서비스 죽이지 않음 — getScan과 동일 계약).
  // last_used_at 갱신은 fire-and-forget: await하지 않아 응답을 지연시키지 않고, 실패해도 무시(조회 결과에 영향 없음).
  async getApiKey(keyHash: string): Promise<ApiKeyRecord | null> {
    const { data, error } = await client()
      .from("api_keys")
      .select("tier,revoked,paid_until")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (error) {
      console.error("getApiKey DB 에러:", error.message);
      return null;
    }
    if (!data) return null;
    void client()
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash)
      .then(({ error: e }) => {
        if (e) console.error("api_keys last_used_at 갱신 실패(무시):", e.message);
      });
    return mapApiKey(data as ApiKeyRow);
  },

  // 활성(미회수) 키 개수 — head:true + count:exact로 행을 가져오지 않고 개수만 센다(PII·대역폭 최소화).
  // 에러 시 안전값 0(getApiKey와 동일한 fail-open 철학 — 발급 게이트가 DB 블립으로 정상 사용자를 막지 않게).
  async countActiveKeysByEmail(email: string): Promise<number> {
    const { count, error } = await client()
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("revoked", false);
    if (error) {
      console.error("countActiveKeysByEmail DB 에러(안전값 0):", error.message);
      return 0;
    }
    return count ?? 0;
  },
};

// ── 최소 자가검증(assert) — 매퍼(snake↔camel)가 깨지면 즉시 실패. 라이브 DB 불필요 ────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const scan = mapScan({ id: "abc", created_at: "2026-07-08T00:00:00Z", score_total: 42, categories: [], meta: { v: 1, totals: {}, flags: {} } });
  if (scan.scoreTotal !== 42 || scan.id !== "abc") throw new Error("FAIL mapScan");
  const sub = mapSub({ email: "a@b.co", created_at: "2026-07-08T00:00:00Z", confirmed: false, unsub_token: "tok" });
  if (sub.email !== "a@b.co" || sub.unsubToken !== "tok") throw new Error("FAIL mapSub");
  const log = mapLog({ created_at: "2026-07-08T00:00:00Z", query: "청약", matched_usecase: null, result_count: 3 });
  if (log.query !== "청약" || log.matchedUsecase !== null || log.resultCount !== 3) throw new Error("FAIL mapLog");
  const ak = mapApiKey({ tier: "free", revoked: false, paid_until: null });
  if (ak.tier !== "free" || ak.revoked !== false || ak.paidUntil !== null) throw new Error("FAIL mapApiKey free");
  const akPaid = mapApiKey({ tier: "paid", revoked: true, paid_until: "2026-08-01T00:00:00Z" });
  if (akPaid.tier !== "paid" || akPaid.revoked !== true || akPaid.paidUntil !== "2026-08-01T00:00:00Z") throw new Error("FAIL mapApiKey paid");
  if (mapApiKey({ tier: "bogus", revoked: false, paid_until: null }).tier !== "free") throw new Error("FAIL mapApiKey tier 좁히기");
  if (!UUID_RE.test("12345678-1234-1234-1234-123456789abc")) throw new Error("FAIL uuid ok");
  if (UUID_RE.test("not-a-uuid")) throw new Error("FAIL uuid reject");
  // confirm/unsubscribe 토큰 가드는 client() 이전에 조기 반환 → 라이브 DB 없이 검증 가능.
  const guardTokens = ["", "   ", "not-a-uuid"];
  for (const t of guardTokens) {
    if ((await supabaseDb.confirmSubscriber(t)).ok) throw new Error(`FAIL confirm guard: "${t}"가 통과됨`);
    if ((await supabaseDb.unsubscribe(t)).ok) throw new Error(`FAIL unsubscribe guard: "${t}"가 통과됨`);
  }
  console.log("supabase.ts self-check OK");
}
