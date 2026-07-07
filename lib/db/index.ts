// DB 어댑터 인터페이스 (스펙 §3, §4). 오늘은 memory 구현을 export.
// 스왑 지점: DB_ADAPTER 환경변수나 여기 한 줄만 바꾸면 supabase로 교체.

import type { Category } from "@/lib/score";

// scans(id, created_at, score_total, categories jsonb, meta jsonb) — 스펙 §4
export interface ScanMeta {
  // 개수·불리언만 (스펙 §4: 스킬 이름·파일 내용 금지 = 개인정보 최소화)
  totals: Record<string, number>;
  flags: Record<string, boolean>;
  v: number; // 페이로드 스키마 버전
}

export interface ScanRecord {
  id: string;
  createdAt: string; // ISO
  scoreTotal: number; // 서버 재계산값
  categories: Category[];
  meta: ScanMeta;
}

export interface SaveScanInput {
  scoreTotal: number;
  categories: Category[];
  meta: ScanMeta;
}

// subscribers(email pk, created_at, confirmed, unsub_token) — 스펙 §4
export interface SubscriberRecord {
  email: string; // 정규화(소문자·trim)된 값이 pk
  createdAt: string;
  confirmed: boolean;
  unsubToken: string;
}

// search_logs(created_at, query, matched_usecase, result_count) — 프라이버시 우선.
// IP·개인정보 없음(스펙 기능2). 검색 추천 개선용 익명 집계 전용.
export interface SearchLogRecord {
  createdAt: string; // ISO
  query: string; // 1~100자, trim됨
  matchedUsecase: string | null; // 매칭된 유스케이스 id (없으면 null = 미매칭 후보)
  resultCount: number;
}

export interface SearchLogInput {
  query: string;
  matchedUsecase: string | null;
  resultCount: number;
}

export interface DbAdapter {
  saveScan(input: SaveScanInput): Promise<ScanRecord>;
  getScan(id: string): Promise<ScanRecord | null>;
  addSubscriber(email: string): Promise<{ record: SubscriberRecord; created: boolean }>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  logSearch(input: SearchLogInput): Promise<void>;
  listSearchLogs(): Promise<SearchLogRecord[]>;
}

import { memoryDb } from "./memory";

// 단일 export 지점. P2: 여기서 process.env.DB_ADAPTER 분기하여 supabaseDb 반환.
export const db: DbAdapter = memoryDb;
