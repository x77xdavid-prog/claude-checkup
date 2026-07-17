// POST /api/keys — 무료 API 키 발급 (MCP 수익화 2단계, docs/STRATEGY-mcp-monetize-2026-07-17.md §2).
// {email} → 정규화·검증 → 키 생성 → 해시 저장 → 응답에 원문 1회 노출.
//
// v1(현재): RESEND 미장착이라 확인메일을 못 보낸다. 그래서 더블옵트인 없이 즉시 발급하고
//           DB엔 verified=false로 저장한다. 메일 확인 발급(확인 링크 클릭 시 키 노출)은
//           RESEND 장착 후 승격 예정 — subscribe 라우트의 emailLive 분기와 동일한 방식으로 붙인다.
// 같은 이메일 재요청 = 새 키 추가 발급 허용(회수는 revoked 플래그로 — 관리 스크립트는 scope 외).

import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/schema";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { generateKey } from "@/lib/keys";

export const runtime = "nodejs"; // node:crypto(키 생성) + 인메모리/서버 어댑터에 node 런타임 고정

const MAX_BYTES = 4 * 1024; // subscribe와 동일한 작은 상한(이메일 하나 — 신뢰 경계, 파싱 전 원문 기준, M2)
const FREE_LIMIT_PER_MIN = 120; // 무료 키 티어 한도 — lib/ratelimit.ts LIMITS.mcpFree와 일치
const MAX_KEYS_PER_EMAIL = 5; // 이메일당 활성(미회수) 키 상한 — 미검증 즉시발급 남용 방어층(H1)

// 이메일 형태만 얇게 검증(값 검증은 normalizeEmail이 담당) + 허니팟. strict로 잉여 필드 거부.
const bodySchema = z
  .object({
    email: z.string().min(3).max(254),
    website: z.string().max(200).optional(), // 허니팟(subscribe와 동일) — 채워져 오면 봇
  })
  .strict();

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // 1) 레이트리밋 (분당 3회)
  const ip = clientIp(req.headers);
  const rl = await rateLimit("keys", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 2) 크기 제한 (파싱 전, UTF-8 바이트 기준)
  const raw = await req.text();
  if (raw.length === 0) return bad(400, "빈 요청");
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return bad(413, "페이로드가 너무 큽니다");

  // 3) JSON 파싱 + 스키마
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return bad(400, "JSON 형식 오류");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return bad(400, "잘못된 요청");

  // 4) 허니팟(H1): website 값이 채워져 오면 봇 → 실제 발급/DB쓰기 없이 정상 200처럼 응답(단, 키는 미노출).
  //    subscribe 라우트와 동일 방식 — 봇이 탐지 여부를 구분하지 못하게 성공 톤은 유지하되 비밀(키)만 뺀다.
  const { website } = parsed.data;
  if (website && website.trim() !== "") {
    return NextResponse.json(
      { tier: "free", limitPerMin: FREE_LIMIT_PER_MIN, note: "키는 이 응답에만 표시됩니다. 분실 시 재발급하세요." },
      { status: 200 },
    );
  }

  // 5) 이메일 정규화 + 검증 (subscribe 라우트와 동일 로직 재사용)
  const normalized = normalizeEmail(parsed.data.email);
  if (!normalized) return bad(400, "올바른 이메일 형식이 아닙니다");

  // 6) 이메일당 활성 키 상한(H1) — 레이트리밋(3/min/IP)과 별개의 방어층. 초과 시 429(발급 거부, 기존 키 사용 유도).
  //    countActiveKeysByEmail은 DB 에러 시 안전값 0을 반환(어댑터 계약) → 이 게이트가 블립으로 정상 발급을 막지 않는다.
  const activeCount = await db.countActiveKeysByEmail(normalized);
  if (activeCount >= MAX_KEYS_PER_EMAIL) {
    return NextResponse.json(
      { error: "이 이메일의 활성 키가 많습니다. 기존 키를 쓰세요." },
      { status: 429 },
    );
  }

  // 7) 키 생성 → 해시 저장. 발급 실패는 감추지 않는다(500) — 사용자가 재시도/마이그레이션을 알 수 있게.
  const { key, hash } = generateKey();
  try {
    await db.createApiKey({ keyHash: hash, email: normalized });
  } catch (e) {
    console.error("createApiKey 실패:", e instanceof Error ? e.message : String(e));
    return bad(500, "키 발급에 실패했습니다. 잠시 후 다시 시도하세요.");
  }

  // 8) 원문 키는 이 응답에만 노출(DB엔 해시만).
  return NextResponse.json(
    {
      key,
      tier: "free",
      limitPerMin: FREE_LIMIT_PER_MIN,
      note: "키는 이 응답에만 표시됩니다. 분실 시 재발급하세요.",
    },
    { status: 200 },
  );
}

export function GET() {
  return bad(405, "POST만 허용");
}
