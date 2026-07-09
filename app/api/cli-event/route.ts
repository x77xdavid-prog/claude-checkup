// POST /api/cli-event — CLI(checkup-skills) 텔레메트리 이벤트 수집 (프라이버시 우선).
// 검증 → 레이트리밋 → 익명 저장. IP·머신ID·경로는 절대 저장하지 않는다(레이트리밋 키로만 IP 사용, 미영속).
// fire-and-forget CLI가 호출 → 실패해도 CLI 동작에 영향 없음. 성공 시 {ok:true}.

import { NextResponse } from "next/server";
import { cliEventPayloadSchema } from "@/lib/schema";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024; // 작은 페이로드 — event/value/cliVersion/locale/ts 몇 필드뿐

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // 1) 레이트리밋 (분당 30회) — ip는 카운트 키로만 쓰고 저장하지 않음.
  const ip = clientIp(req.headers);
  const rl = await rateLimit("cliEvent", ip);
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

  // 3) 스키마 검증 (event enum, value 1~120자, cliVersion, locale, ts — 그 외 필드는 strict()가 거부)
  const parsed = cliEventPayloadSchema.safeParse(json);
  if (!parsed.success) return bad(400, "잘못된 요청");
  const { event, value, cliVersion, locale } = parsed.data;

  // 4) 익명 저장 (IP·머신ID·경로 없음). ts는 검증만 하고 저장하지 않는다 — created_at은 서버가 부여.
  await db.logCliEvent({ event, value, cliVersion, locale });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export function GET() {
  return bad(405, "POST만 허용");
}
