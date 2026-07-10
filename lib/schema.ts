// API 페이로드 zod 스키마 (스펙 §6). route에서 재사용.
// 신뢰 경계 검증 — 절대 생략 금지.

import { z } from "zod";
import { VERDICTS } from "@/lib/score";

// 스캐너와 공유되는 계약(스펙 §3). 이대로 정확히.
// categories 최대 12개, score 0~100, verdict enum. 페이로드 32KB는 route에서 바이트로 체크.

const totalsSchema = z
  .object({
    skills: z.number().int().min(0).max(100000),
    agents: z.number().int().min(0).max(100000),
    hooks: z.number().int().min(0).max(100000),
    plugins: z.number().int().min(0).max(100000),
    mcpServers: z.number().int().min(0).max(100000),
    sessions: z.number().int().min(0).max(1000000),
    projects: z.number().int().min(0).max(100000),
  })
  .strict();

const flagsSchema = z
  .object({
    hasClaudeMd: z.boolean(),
    hasMemory: z.boolean(),
    modelConfigured: z.boolean(),
    hasPlaywright: z.boolean(),
    hasCron: z.boolean(),
    hasWorkflows: z.boolean(),
  })
  .strict();

const categorySchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9_-]+$/, "key는 영문 소문자 슬러그만"),
    label: z.string().min(1).max(60),
    score: z.number().min(0).max(100),
    verdict: z.enum(VERDICTS),
  })
  .strict();

export const scanPayloadSchema = z
  .object({
    v: z.literal(1),
    totals: totalsSchema,
    flags: flagsSchema,
    categories: z.array(categorySchema).min(1).max(12),
  })
  .strict();

export type ScanPayload = z.infer<typeof scanPayloadSchema>;

// 이메일: 정규식 + 소문자·trim 정규화. RFC 완벽 대신 실용적 검증(스펙 §6).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribePayloadSchema = z
  .object({
    email: z.string().min(3).max(254),
    website: z.string().max(200).optional().default(""), // 허니팟
  })
  .strict();

export type SubscribePayload = z.infer<typeof subscribePayloadSchema>;

// 검색 로그(스펙 기능2) — 프라이버시 우선. query 1~100자, resultCount 정수.
// IP·개인정보는 페이로드에 없음(route에서도 저장 안 함). matchedUsecase는 유스케이스 id(선택).
export const searchLogPayloadSchema = z
  .object({
    query: z.string().trim().min(1).max(100),
    matchedUsecase: z.string().max(60).nullable().optional().default(null),
    resultCount: z.number().int().min(0).max(100000),
  })
  .strict();

export type SearchLogPayload = z.infer<typeof searchLogPayloadSchema>;

// CLI(checkup-skills) 텔레메트리 이벤트 — 프라이버시 우선. 정확히 이 5개 필드만(.strict()).
// IP·머신ID·경로 등은 페이로드 자체에 없다. ts는 형태만 검증하고 저장하지 않는다(서버는 created_at default now() 사용).
export const cliEventPayloadSchema = z
  .object({
    event: z.enum(["search", "info"]),
    value: z.string().min(1).max(120),
    cliVersion: z.string().min(1).max(40),
    locale: z.string().max(20).nullable().optional().default(null),
    ts: z.string().min(1).max(40),
  })
  .strict();

export type CliEventPayload = z.infer<typeof cliEventPayloadSchema>;

// 웹 퍼널 이벤트(온보딩 북극성 — install/prompt/mcp 복사 + start_level 레벨테스트 완료) — 프라이버시 우선.
// 정확히 이 3개 필드만(.strict()). IP·쿠키·UA는 페이로드 자체에 없다(sendBeacon 본문에도 없음).
// name은 스킬명 또는 레벨(lv0~lv4, 선택), locale은 UI 로케일(선택).
export const funnelEventPayloadSchema = z
  .object({
    event: z.enum(["install_copy", "prompt_copy", "mcp_copy", "start_level"]),
    name: z.string().max(120).nullable().optional().default(null),
    locale: z.string().max(5).nullable().optional().default(null),
  })
  .strict();

export type FunnelEventPayload = z.infer<typeof funnelEventPayloadSchema>;

// 퍼널 통계 조회 쿼리(GET /api/funnel-stats) — days: 1~30 정수, 기본 7. 그 외 필드는 strict()가 거부.
// searchParams 값은 문자열로 들어오므로 coerce로 숫자 변환(빈 문자열·소수·범위 밖은 전부 검증 실패 → route가 400).
export const funnelStatsQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(30).default(7),
  })
  .strict();

export type FunnelStatsQuery = z.infer<typeof funnelStatsQuerySchema>;

// 이메일 정규화 + 검증. 유효하면 정규화된 값, 아니면 null.
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return null;
  if (e.length > 254) return null;
  return e;
}

// ── 최소 자가검증 ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const ok = scanPayloadSchema.safeParse({
    v: 1,
    totals: { skills: 0, agents: 0, hooks: 0, plugins: 0, mcpServers: 0, sessions: 0, projects: 0 },
    flags: { hasClaudeMd: true, hasMemory: true, modelConfigured: true, hasPlaywright: true, hasCron: false, hasWorkflows: false },
    categories: [{ key: "basics", label: "기본 코딩 활용", score: 0, verdict: "잘씀" }],
  });
  if (!ok.success) throw new Error("FAIL: 유효 페이로드가 거부됨 " + JSON.stringify(ok.error.issues));
  // verdict enum 위반
  if (scanPayloadSchema.safeParse({ ...ok.data, categories: [{ ...ok.data.categories[0], verdict: "이상함" }] }).success)
    throw new Error("FAIL: 잘못된 verdict 통과");
  // 13개 초과
  const many = Array.from({ length: 13 }, () => ok.data.categories[0]);
  if (scanPayloadSchema.safeParse({ ...ok.data, categories: many }).success) throw new Error("FAIL: 13개 통과");
  // 이메일
  if (normalizeEmail("  A@B.CO ") !== "a@b.co") throw new Error("FAIL: 이메일 정규화");
  if (normalizeEmail("nope") !== null) throw new Error("FAIL: 잘못된 이메일 통과");
  // 검색 로그
  const sl = searchLogPayloadSchema.safeParse({ query: " 청약 ", resultCount: 3 });
  if (!sl.success || sl.data.query !== "청약" || sl.data.matchedUsecase !== null) throw new Error("FAIL: 검색로그 정상 케이스");
  if (searchLogPayloadSchema.safeParse({ query: "", resultCount: 0 }).success) throw new Error("FAIL: 빈 query 통과");
  if (searchLogPayloadSchema.safeParse({ query: "x".repeat(101), resultCount: 0 }).success) throw new Error("FAIL: 101자 query 통과");
  if (searchLogPayloadSchema.safeParse({ query: "x", resultCount: 1.5 }).success) throw new Error("FAIL: 소수 resultCount 통과");
  // CLI 텔레메트리 이벤트
  const ce = cliEventPayloadSchema.safeParse({
    event: "search",
    value: "청약",
    cliVersion: "0.2.0",
    locale: "ko_KR",
    ts: new Date().toISOString(),
  });
  if (!ce.success) throw new Error("FAIL: 유효 cliEvent 페이로드가 거부됨 " + JSON.stringify(ce.error.issues));
  if (ce.data.locale !== "ko_KR") throw new Error("FAIL: cliEvent locale 보존 안 됨");
  const ceNoLocale = cliEventPayloadSchema.safeParse({ event: "info", value: "commit", cliVersion: "0.2.0", ts: "t" });
  if (!ceNoLocale.success || ceNoLocale.data.locale !== null) throw new Error("FAIL: locale 생략 시 null 기본값이어야 함");
  if (cliEventPayloadSchema.safeParse({ event: "bogus", value: "x", cliVersion: "0.2.0", ts: "t" }).success)
    throw new Error("FAIL: 잘못된 event enum 통과");
  if (cliEventPayloadSchema.safeParse({ event: "search", value: "x".repeat(121), cliVersion: "0.2.0", ts: "t" }).success)
    throw new Error("FAIL: 121자 value 통과");
  if (cliEventPayloadSchema.safeParse({ event: "search", value: "", cliVersion: "0.2.0", ts: "t" }).success)
    throw new Error("FAIL: 빈 value 통과");
  if (cliEventPayloadSchema.safeParse({ event: "search", value: "x", cliVersion: "0.2.0", ts: "t", ip: "1.2.3.4" }).success)
    throw new Error("FAIL: 스펙에 없는 필드(ip 등)가 strict를 뚫고 통과함");
  // 웹 퍼널 복사 이벤트
  const fe = funnelEventPayloadSchema.safeParse({ event: "install_copy", name: " contextvibes ", locale: "ko" });
  if (!fe.success || fe.data.event !== "install_copy" || fe.data.locale !== "ko") throw new Error("FAIL: 유효 funnelEvent 페이로드가 거부됨");
  const feBare = funnelEventPayloadSchema.safeParse({ event: "mcp_copy" });
  if (!feBare.success || feBare.data.name !== null || feBare.data.locale !== null) throw new Error("FAIL: name/locale 생략 시 null 기본값이어야 함");
  // start_level(레벨테스트 완료) — name=lv0~lv4.
  const feStart = funnelEventPayloadSchema.safeParse({ event: "start_level", name: "lv3" });
  if (!feStart.success || feStart.data.event !== "start_level" || feStart.data.name !== "lv3") throw new Error("FAIL: 유효 start_level 페이로드가 거부됨");
  if (funnelEventPayloadSchema.safeParse({ event: "bogus" }).success) throw new Error("FAIL: 잘못된 funnel event enum 통과");
  if (funnelEventPayloadSchema.safeParse({ event: "install_copy", name: "x".repeat(121) }).success) throw new Error("FAIL: 121자 name 통과");
  if (funnelEventPayloadSchema.safeParse({ event: "install_copy", locale: "x".repeat(6) }).success) throw new Error("FAIL: 6자 locale 통과");
  if (funnelEventPayloadSchema.safeParse({ event: "install_copy", extra: "x" }).success) throw new Error("FAIL: 스펙에 없는 필드가 strict를 뚫고 통과함");
  // 퍼널 통계 조회 쿼리
  const fsDefault = funnelStatsQuerySchema.safeParse({});
  if (!fsDefault.success || fsDefault.data.days !== 7) throw new Error("FAIL: days 생략 시 기본값 7이어야 함");
  const fsCoerced = funnelStatsQuerySchema.safeParse({ days: "14" });
  if (!fsCoerced.success || fsCoerced.data.days !== 14) throw new Error("FAIL: days 문자열 강제변환 실패");
  if (funnelStatsQuerySchema.safeParse({ days: "0" }).success) throw new Error("FAIL: days=0 통과");
  if (funnelStatsQuerySchema.safeParse({ days: "31" }).success) throw new Error("FAIL: days=31 통과");
  if (funnelStatsQuerySchema.safeParse({ days: "7.5" }).success) throw new Error("FAIL: 소수 days 통과");
  if (funnelStatsQuerySchema.safeParse({ days: "abc" }).success) throw new Error("FAIL: days=abc 통과");
  if (funnelStatsQuerySchema.safeParse({ days: "7", extra: "x" }).success) throw new Error("FAIL: 스펙에 없는 필드가 strict를 뚫고 통과함(query)");
  console.log("schema.ts self-check OK");
}
