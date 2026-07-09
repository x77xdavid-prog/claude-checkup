// GET /api/confirm?token=... — 이중 옵트인 확인 링크. 구독 메일의 "구독 확인하기" 버튼 대상.
// unsub_token으로 confirmed=true. 알 수 없는/만료 토큰은 이메일 존재 여부를 드러내지 않는 중립 문구(열거 방지).

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { noticePage } from "@/lib/notice-page";

export const runtime = "nodejs";

// 중립 문구 — 토큰이 없든/틀리든/만료됐든 동일. 구독자 이메일 존재 여부를 유추할 수 없게 한다.
const NEUTRAL = "링크가 유효하지 않거나 만료되었습니다.";

export async function GET(req: Request) {
  // 링크 클릭·프리페치 대비 저빈도 레이트리밋(분당 15).
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
  if (!token) return noticePage({ title: "링크가 유효하지 않습니다", message: NEUTRAL, status: 400 });

  const { ok } = await db.confirmSubscriber(token);
  if (ok) {
    return noticePage({
      title: "구독이 확인되었습니다",
      message: "이제 새로 추가되는 검증된 스킬 소식을 이메일로 받아보실 수 있습니다.",
      status: 200,
    });
  }
  return noticePage({ title: "링크가 유효하지 않습니다", message: NEUTRAL, status: 200 });
}
