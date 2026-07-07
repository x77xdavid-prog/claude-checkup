// POST /api/subscribe — 이메일 뉴스레터 등록 (스펙 §3, §6).
// 허니팟 → 정규화/검증 → 멱등 저장. 확인메일·해지는 P3.

import { NextResponse } from "next/server";
import { subscribePayloadSchema, normalizeEmail } from "@/lib/schema";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024; // 작은 페이로드 — 이메일 하나

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // 1) 레이트리밋 (분당 3회)
  const ip = clientIp(req.headers);
  const rl = rateLimit("subscribe", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 2) 크기 + 파싱
  const raw = await req.text();
  if (raw.length === 0) return bad(400, "빈 요청");
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return bad(413, "페이로드가 너무 큽니다");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return bad(400, "JSON 형식 오류");
  }

  // 3) 스키마 (허니팟 필드 포함)
  const parsed = subscribePayloadSchema.safeParse(json);
  if (!parsed.success) return bad(400, "잘못된 요청");
  const { email, website } = parsed.data;

  // 4) 허니팟: 값이 있으면 봇 → 200 반환하되 저장 안 함 (스펙 §6)
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 5) 이메일 정규화 + 검증
  const normalized = normalizeEmail(email);
  if (!normalized) return bad(400, "올바른 이메일 형식이 아닙니다");

  // 6) 멱등 저장 (중복이면 created=false 로 200)
  const { created } = await db.addSubscriber(normalized);
  return NextResponse.json({ ok: true, created }, { status: 200 });
}

export function GET() {
  return bad(405, "POST만 허용");
}
