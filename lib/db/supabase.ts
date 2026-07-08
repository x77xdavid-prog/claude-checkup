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
} from "./index";

// uuid v4 형식 검증 — 잘못된 id로 uuid 컬럼 조회 시 postgres 22P02 에러가 나므로 사전 차단.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
};

// ── 최소 자가검증(assert) — 매퍼(snake↔camel)가 깨지면 즉시 실패. 라이브 DB 불필요 ────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const scan = mapScan({ id: "abc", created_at: "2026-07-08T00:00:00Z", score_total: 42, categories: [], meta: { v: 1, totals: {}, flags: {} } });
  if (scan.scoreTotal !== 42 || scan.id !== "abc") throw new Error("FAIL mapScan");
  const sub = mapSub({ email: "a@b.co", created_at: "2026-07-08T00:00:00Z", confirmed: false, unsub_token: "tok" });
  if (sub.email !== "a@b.co" || sub.unsubToken !== "tok") throw new Error("FAIL mapSub");
  const log = mapLog({ created_at: "2026-07-08T00:00:00Z", query: "청약", matched_usecase: null, result_count: 3 });
  if (log.query !== "청약" || log.matchedUsecase !== null || log.resultCount !== 3) throw new Error("FAIL mapLog");
  if (!UUID_RE.test("12345678-1234-1234-1234-123456789abc")) throw new Error("FAIL uuid ok");
  if (UUID_RE.test("not-a-uuid")) throw new Error("FAIL uuid reject");
  console.log("supabase.ts self-check OK");
}
