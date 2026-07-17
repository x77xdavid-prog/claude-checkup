// DB 어댑터의 memory 구현 (오늘, P1). P2에서 supabase 구현으로 스왑.
// 비즈니스 로직은 DbAdapter 인터페이스에만 의존한다.
//
// ponytail: 인메모리 = 프로세스 재시작 시 소멸. 결과 페이지가 "만료됨"을 처리하므로 P1엔 충분.
//           승급 경로 = lib/db/supabase.ts (스펙 §4 스키마) 를 P2에 추가하고 index.ts에서 교체.

import type {
  DbAdapter,
  ScanRecord,
  SubscriberRecord,
  SaveScanInput,
  SearchLogRecord,
  SearchLogInput,
  FunnelEventInput,
  CreateApiKeyInput,
  ApiKeyRecord,
} from "./index";

// dev의 HMR/모듈 재평가로 저장소가 초기화되는 걸 막기 위해 globalThis에 고정.
type FunnelEventRecord = { event: string; value: string; createdAt: string };
// 스키마와 동형(supabase/migrations/20260717_api_keys.sql). key_hash는 Map의 키라 값에는 두지 않는다.
type ApiKeyRow = {
  email: string;
  tier: "free" | "paid";
  verified: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  paidUntil: string | null;
};

type Store = {
  scans: Map<string, ScanRecord>;
  subscribers: Map<string, SubscriberRecord>; // key = 정규화된 email
  searchLogs: SearchLogRecord[];
  funnelEvents: FunnelEventRecord[]; // GET /api/funnel-stats 집계용(logFunnelEvent가 append)
  apiKeys: Map<string, ApiKeyRow>; // key = key_hash(sha256)
};

const g = globalThis as unknown as { __checkupStore?: Store };
const store: Store =
  g.__checkupStore ??
  (g.__checkupStore = {
    scans: new Map(),
    subscribers: new Map(),
    searchLogs: [],
    funnelEvents: [],
    apiKeys: new Map(),
  });

// P2: search_logs를 Supabase로 승급하면 여기 한도 대신 DB append. 그때까지 메모리 상한.
const SEARCH_LOG_MAX = 5000;
// supabase 어댑터의 listFunnelEvents .limit()과 동일한 상한 — 메모리 폭주 방지.
const FUNNEL_EVENTS_MAX = 10000;

// uuid: node 18+ 표준 crypto.randomUUID 사용 (의존성 0).
function uuid(): string {
  return crypto.randomUUID();
}

export const memoryDb: DbAdapter = {
  async saveScan(input: SaveScanInput): Promise<ScanRecord> {
    const id = uuid();
    const record: ScanRecord = {
      id,
      createdAt: new Date().toISOString(),
      scoreTotal: input.scoreTotal,
      categories: input.categories,
      meta: input.meta,
    };
    store.scans.set(id, record);
    return record;
  },

  async getScan(id: string): Promise<ScanRecord | null> {
    return store.scans.get(id) ?? null;
  },

  // 멱등: 이미 있으면 기존 레코드 반환(중복 저장 안 함). created = 신규 여부.
  async addSubscriber(email: string): Promise<{ record: SubscriberRecord; created: boolean }> {
    const existing = store.subscribers.get(email);
    if (existing) return { record: existing, created: false };
    const record: SubscriberRecord = {
      email,
      createdAt: new Date().toISOString(),
      confirmed: false,
      unsubToken: uuid(),
    };
    store.subscribers.set(email, record);
    return { record, created: true };
  },

  async listSubscribers(): Promise<SubscriberRecord[]> {
    return [...store.subscribers.values()];
  },

  // 이중 옵트인 확인 — unsub_token으로 찾아 confirmed=true(불변 갱신: 새 레코드로 교체). 이미 확인돼도 멱등하게 {ok:true}.
  // 알 수 없는 토큰(비-uuid 포함)은 map에서 안 잡혀 자연히 {ok:false}. supabaseDb와 동일 계약.
  async confirmSubscriber(token: string): Promise<{ ok: boolean; email?: string }> {
    if (typeof token !== "string" || !token) return { ok: false };
    for (const [email, rec] of store.subscribers) {
      if (rec.unsubToken === token) {
        if (!rec.confirmed) store.subscribers.set(email, { ...rec, confirmed: true });
        return { ok: true, email: rec.email };
      }
    }
    return { ok: false };
  },

  // 수신거부 — unsub_token으로 찾아 삭제. 알 수 없는/재클릭 토큰은 {ok:false}(route가 멱등 처리).
  async unsubscribe(token: string): Promise<{ ok: boolean }> {
    if (typeof token !== "string" || !token) return { ok: false };
    for (const [email, rec] of store.subscribers) {
      if (rec.unsubToken === token) {
        store.subscribers.delete(email);
        return { ok: true };
      }
    }
    return { ok: false };
  },

  // 검색 로그 append — 프라이버시 우선(IP·개인정보 없음). 서버 재시작 시 휘발.
  // ponytail: 인메모리 = 재시작 시 소멸 → 집계 스크립트는 실제 데이터 없음(스텁).
  //           승급 경로 = P2에서 lib/db/supabase.ts의 search_logs 테이블 insert로 교체.
  async logSearch(input: SearchLogInput): Promise<void> {
    store.searchLogs.push({
      createdAt: new Date().toISOString(),
      query: input.query,
      matchedUsecase: input.matchedUsecase,
      resultCount: input.resultCount,
    });
    // 메모리 폭주 방지 — 상한 초과 시 오래된 것부터 버림.
    if (store.searchLogs.length > SEARCH_LOG_MAX) {
      store.searchLogs.splice(0, store.searchLogs.length - SEARCH_LOG_MAX);
    }
  },

  async listSearchLogs(): Promise<SearchLogRecord[]> {
    return [...store.searchLogs];
  },

  // CLI 텔레메트리 — memory 어댑터는 정말로 아무것도 하지 않는다(no-op, 정직).
  // 로컬 개발(supabase 키 없음)에선 영속 저장소가 없다는 사실을 감추지 않는다.
  async logCliEvent(): Promise<void> {},

  // 웹 퍼널 복사 이벤트 — GET /api/funnel-stats 집계가 이 배열을 읽으므로 실제로 저장한다(logCliEvent와 달리 no-op 아님).
  // PII 없음(event·value·시각만). 서버 재시작 시 휘발(search_logs와 동일 계약) — 상한 초과 시 오래된 것부터 버림.
  async logFunnelEvent(input: FunnelEventInput): Promise<void> {
    store.funnelEvents.push({ event: input.event, value: input.name ?? "", createdAt: new Date().toISOString() });
    if (store.funnelEvents.length > FUNNEL_EVENTS_MAX) {
      store.funnelEvents.splice(0, store.funnelEvents.length - FUNNEL_EVENTS_MAX);
    }
  },

  // 웹 퍼널 통계 조회 — sinceIso 이후 이벤트의 event·value만 반환(created_at 미반환, supabase 어댑터와 동일 계약).
  // ISO 8601(toISOString, 항상 UTC 'Z' 고정폭) 문자열이라 사전순 비교가 곧 시간순 비교와 같다.
  async listFunnelEvents(sinceIso: string): Promise<Array<{ event: string; value: string }>> {
    return store.funnelEvents.filter((e) => e.createdAt >= sinceIso).map((e) => ({ event: e.event, value: e.value }));
  },

  // 무료 키 발급 — 스키마 default와 동형으로 초기화(tier=free, verified=false). 같은 email 재발급은 새 해시로 추가 저장.
  async createApiKey(input: CreateApiKeyInput): Promise<void> {
    store.apiKeys.set(input.keyHash, {
      email: input.email,
      tier: "free",
      verified: false,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revoked: false,
      paidUntil: null,
    });
  },

  // 키 조회 — 없으면 null(익명 폴백). last_used_at은 불변 갱신(confirmSubscriber와 동일 패턴).
  async getApiKey(keyHash: string): Promise<ApiKeyRecord | null> {
    const rec = store.apiKeys.get(keyHash);
    if (!rec) return null;
    store.apiKeys.set(keyHash, { ...rec, lastUsedAt: new Date().toISOString() });
    return { tier: rec.tier, revoked: rec.revoked, paidUntil: rec.paidUntil };
  },

  // 활성(미회수) 키 개수 — 같은 email의 revoked=false 행 수. 인메모리 순회라 에러 경로 없음(항상 안전값).
  async countActiveKeysByEmail(email: string): Promise<number> {
    let n = 0;
    for (const rec of store.apiKeys.values()) {
      if (rec.email === email && !rec.revoked) n++;
    }
    return n;
  },
};
