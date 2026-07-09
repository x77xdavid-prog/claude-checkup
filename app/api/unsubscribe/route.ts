// GET /api/unsubscribe?token=... — 모든 메일 푸터의 "수신거부" 링크 대상(정보통신망법·CAN-SPAM 필수).
// unsub_token으로 구독자 삭제(GDPR clean). 사용자 관점에선 멱등: 재클릭(이미 삭제)해도 안전한 중립 문구.

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { noticePage } from "@/lib/notice-page";

export const runtime = "nodejs";

// 중립 문구 — 없는/이미 해지된 토큰 공통. 이메일 존재 여부를 드러내지 않는다(열거 방지).
const NEUTRAL = "링크가 유효하지 않거나 이미 해지된 구독입니다.";

export async function GET(req: Request) {
  const rl = await rateLimit("confirm", clientIp(req.headers));
  if (!rl.allowed) {
    return noticePage({
      title: "잠시 후 다시 시도해 주세요",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      status: 429,
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return noticePage({ title: "수신거부", message: NEUTRAL, status: 400 });

  const { ok } = await db.unsubscribe(token);
  if (ok) {
    return noticePage({
      title: "구독이 해지되었습니다",
      message: "앞으로 뉴스레터를 보내드리지 않습니다. 그동안 함께해 주셔서 감사합니다.",
      status: 200,
    });
  }
  return noticePage({ title: "수신거부", message: NEUTRAL, status: 200 });
}
