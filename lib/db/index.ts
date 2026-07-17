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

// 웹 퍼널 이벤트 — 별도 테이블 없이 cli_events를 재사용한다(제로 신규 인프라).
//   event  = 복사 3종 + 온보딩 레벨 도달(web_start_level, name=lv0..lv4) — web_ 접두사로 CLI 이벤트와 구분
//   name   → cli_events.value 에 저장(스킬명·레벨, 없으면 "").  locale → cli_events.locale.
//   cli_version 은 어댑터가 "web"으로 채워 소스를 구분한다(CLI 버전 대신 클라이언트 식별자).
// 프라이버시 우선: IP·쿠키·UA 없음. created_at은 서버가 부여.
export interface FunnelEventInput {
  event: "web_install_copy" | "web_prompt_copy" | "web_mcp_copy" | "web_start_level";
  name: string | null;
  locale: string | null;
}

// api_keys(key_hash pk, email, tier, verified, created_at, last_used_at, revoked, paid_until) — MCP 수익화 2단계.
// 키 원문은 저장하지 않는다(sha256 해시가 pk). 스키마 = supabase/migrations/20260717_api_keys.sql.
export interface CreateApiKeyInput {
  keyHash: string; // sha256(key) hex
  email: string; // 정규화(소문자·trim)된 값
}

// MCP 래퍼가 티어 분기에 쓰는 최소 필드만 반환(email·created_at 등은 검증에 불필요 = PII 최소화).
export interface ApiKeyRecord {
  tier: "free" | "paid";
  revoked: boolean;
  paidUntil: string | null; // ISO, 유료 만료(3단계). 무료 키는 null.
}

export interface DbAdapter {
  saveScan(input: SaveScanInput): Promise<ScanRecord>;
  getScan(id: string): Promise<ScanRecord | null>;
  addSubscriber(email: string): Promise<{ record: SubscriberRecord; created: boolean }>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  // 이중 옵트인: unsub_token으로 구독 확인(confirmed=true). 알 수 없는/잘못된 토큰은 {ok:false}(throw 금지).
  confirmSubscriber(token: string): Promise<{ ok: boolean; email?: string }>;
  // 수신거부: unsub_token으로 구독자 삭제(GDPR clean). 알 수 없는/잘못된 토큰은 {ok:false}(throw 금지).
  unsubscribe(token: string): Promise<{ ok: boolean }>;
  logSearch(input: SearchLogInput): Promise<void>;
  listSearchLogs(): Promise<SearchLogRecord[]>;
  logCliEvent(input: CliEventInput): Promise<void>;
  logFunnelEvent(input: FunnelEventInput): Promise<void>;
  // 웹 퍼널 통계 조회(GET /api/funnel-stats 전용) — cli_version='web' AND created_at>=sinceIso인 행의 event·value만.
  // PII 없음: created_at조차 반환하지 않는다(집계에 불필요). 집계 자체는 route의 순수 함수가 담당(어댑터는 원시 행만 반환).
  listFunnelEvents(sinceIso: string): Promise<Array<{ event: string; value: string }>>;
  // 무료 API 키 발급 — key_hash(sha256) + email 저장. tier=free/verified=false로 시작.
  createApiKey(input: CreateApiKeyInput): Promise<void>;
  // 키 조회(MCP 티어 분기) — 없거나 테이블 미존재/DB 에러면 null(익명 티어로 안전 폴백, 서비스 중단 금지).
  // last_used_at 갱신은 fire-and-forget(응답 지연 없이).
  getApiKey(keyHash: string): Promise<ApiKeyRecord | null>;
  // 이메일당 활성(미회수) 키 개수 — 미검증 이메일 즉시발급의 남용을 막는 발급 상한 게이트 전용(H1).
  // DB 에러 시 안전값 0으로 폴백(레이트리밋이 여전히 남용을 억제, createApiKey가 최종 권위) — 서비스 중단 금지.
  countActiveKeysByEmail(email: string): Promise<number>;
}

import { memoryDb } from "./memory";
import { supabaseDb } from "./supabase";
import { selectAdapter } from "./select";

// 단일 export 지점. 어댑터 선택은 selectAdapter(순수 함수, select.ts)에 위임한다.
//   supabase = SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY 둘 다 있을 때(=배포).
//   memory   = 그 외(로컬 개발·키 없는 빌드) — 프로세스 재시작 시 휘발.
// supabase.ts는 createClient를 팩토리 안에서만 호출하므로, memory 경로에선 import돼도 부작용 없음.
export const db: DbAdapter = selectAdapter() === "supabase" ? supabaseDb : memoryDb;
