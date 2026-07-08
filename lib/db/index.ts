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

// cli_events(id, event, value, cli_version, locale, created_at) — CLI(checkup-skills) 텔레메트리.
// 프라이버시 우선: IP·머신ID·경로 없음. created_at은 서버가 부여(클라이언트 ts는 route에서 검증만 하고 버림).
export interface CliEventInput {
  event: "search" | "info";
  value: string;
  cliVersion: string;
  locale: string | null;
}

export interface DbAdapter {
  saveScan(input: SaveScanInput): Promise<ScanRecord>;
  getScan(id: string): Promise<ScanRecord | null>;
  addSubscriber(email: string): Promise<{ record: SubscriberRecord; created: boolean }>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  logSearch(input: SearchLogInput): Promise<void>;
  listSearchLogs(): Promise<SearchLogRecord[]>;
  logCliEvent(input: CliEventInput): Promise<void>;
}

import { memoryDb } from "./memory";
import { supabaseDb } from "./supabase";
import { selectAdapter } from "./select";

// 단일 export 지점. 어댑터 선택은 selectAdapter(순수 함수, select.ts)에 위임한다.
//   supabase = SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY 둘 다 있을 때(=배포).
//   memory   = 그 외(로컬 개발·키 없는 빌드) — 프로세스 재시작 시 휘발.
// supabase.ts는 createClient를 팩토리 안에서만 호출하므로, memory 경로에선 import돼도 부작용 없음.
export const db: DbAdapter = selectAdapter() === "supabase" ? supabaseDb : memoryDb;
