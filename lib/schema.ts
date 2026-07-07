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
  console.log("schema.ts self-check OK");
}
