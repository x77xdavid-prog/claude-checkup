// DB 어댑터의 memory 구현 (오늘, P1). P2에서 supabase 구현으로 스왑.
// 비즈니스 로직은 DbAdapter 인터페이스에만 의존한다.
//
// ponytail: 인메모리 = 프로세스 재시작 시 소멸. 결과 페이지가 "만료됨"을 처리하므로 P1엔 충분.
//           승급 경로 = lib/db/supabase.ts (스펙 §4 스키마) 를 P2에 추가하고 index.ts에서 교체.

import type { DbAdapter, ScanRecord, SubscriberRecord, SaveScanInput } from "./index";

// dev의 HMR/모듈 재평가로 저장소가 초기화되는 걸 막기 위해 globalThis에 고정.
type Store = {
  scans: Map<string, ScanRecord>;
  subscribers: Map<string, SubscriberRecord>; // key = 정규화된 email
};

const g = globalThis as unknown as { __checkupStore?: Store };
const store: Store =
  g.__checkupStore ??
  (g.__checkupStore = {
    scans: new Map(),
    subscribers: new Map(),
  });

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
};
