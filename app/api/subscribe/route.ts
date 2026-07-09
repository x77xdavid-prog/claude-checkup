// POST /api/subscribe — 이메일 뉴스레터 등록 (스펙 §3, §6).
// 허니팟 → 정규화/검증 → 멱등 저장 → 신규면 확인메일(이중 옵트인) best-effort 발송.

import { NextResponse } from "next/server";
import { subscribePayloadSchema, normalizeEmail } from "@/lib/schema";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { selectEmailAdapter } from "@/lib/email";
import { renderConfirmEmail } from "@/lib/email/render";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024; // 작은 페이로드 — 이메일 하나
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://claudecowork.co.kr";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // RESEND_API_KEY 없으면 확인메일이 dry-run(실발송 없음)이라, "메일 확인" 안내를 띄우면
  // 영원히 확인 못 하는 회귀가 생긴다. 응답/발송 분기를 이 값 하나로 통일한다.
  const emailLive = Boolean((process.env.RESEND_API_KEY || "").trim());

  // 1) 레이트리밋 (분당 3회)
  const ip = clientIp(req.headers);
  const rl = await rateLimit("subscribe", ip);
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

  // 4) 허니팟: 값이 있으면 봇 → 200 반환하되 저장 안 함 (스펙 §6).
  //    응답 형태를 정상 성공과 동일하게 맞춰 봇이 탐지 여부를 구분하지 못하게 한다.
  //    pendingConfirmation도 실제 성공 응답과 같은 계산(emailLive만으로 결정, 입력값과 무관)으로 맞춘다.
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true, created: true, pendingConfirmation: emailLive }, { status: 200 });
  }

  // 5) 이메일 정규화 + 검증
  const normalized = normalizeEmail(email);
  if (!normalized) return bad(400, "올바른 이메일 형식이 아닙니다");

  // 6) 멱등 저장 (중복이면 created=false 로 200)
  const { record, created } = await db.addSubscriber(normalized);

  // 7) 신규 구독자 처리 — emailLive일 때만 진짜 이중 옵트인(확인메일 발송, best-effort).
  //    emailLive가 아니면 메일이 실제로는 안 가므로, 대신 즉시 확인 처리해 구독자가
  //    영원히 미확인 상태로 방치되지 않게 한다(이것도 best-effort, 실패해도 200으로 응답).
  if (created) {
    if (emailLive) {
      const confirmUrl = `${SITE_URL}/api/confirm?token=${encodeURIComponent(record.unsubToken)}`;
      const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
      try {
        const mail = renderConfirmEmail(confirmUrl, unsubUrl);
        const res = await selectEmailAdapter().send({
          to: record.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
        if (!res.ok) console.error("확인메일 발송 실패(무시):", res.error);
      } catch (e) {
        console.error("확인메일 발송 예외(무시):", e instanceof Error ? e.message : String(e));
      }
    } else {
      try {
        await db.confirmSubscriber(record.unsubToken);
      } catch (e) {
        console.error("자동 확인 처리 실패(무시):", e instanceof Error ? e.message : String(e));
      }
    }
  }

  // pendingConfirmation: 신규 + 실제 메일 발송일 때만 true. 그 외(기존 구독자 / 메일 미설정)엔 이미 확인된 상태.
  return NextResponse.json({ ok: true, created, pendingConfirmation: created && emailLive }, { status: 200 });
}

export function GET() {
  return bad(405, "POST만 허용");
}
