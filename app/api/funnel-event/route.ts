// POST /api/funnel-event — 웹 퍼널 복사 이벤트 수집(온보딩 북극성, 프라이버시 우선).
// 검증 → 레이트리밋 → 익명 저장. IP·쿠키·UA는 절대 저장하지 않는다(레이트리밋 키로만 IP 사용, 미영속).
// fire-and-forget 클라이언트(sendBeacon)가 호출 → 실패해도 복사 UX에 영향 없음. 성공 시 {ok:true}.
// 저장소: 별도 테이블 없이 cli_events 재사용(event에 web_ 접두사, cli_version="web"). 스키마 = supabase/migrations/0002_cli_events.sql.

import { NextResponse } from "next/server";
import { funnelEventPayloadSchema } from "@/lib/schema";
import { db, type FunnelEventInput } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024; // 작은 페이로드 — event/name/locale 몇 필드뿐

// 페이로드 이벤트(짧은 형태) → 저장 이벤트(web_ 접두사로 CLI 이벤트와 구분). 타입 안전 매핑.
const EVENT_MAP = {
  install_copy: "web_install_copy",
  prompt_copy: "web_prompt_copy",
  mcp_copy: "web_mcp_copy",
  start_level: "web_start_level",
} as const;

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // 1) 레이트리밋 (분당 30회) — ip는 카운트 키로만 쓰고 저장하지 않음.
  const ip = clientIp(req.headers);
  const rl = await rateLimit("funnel", ip);
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

  // 3) 스키마 검증 (event enum, name ≤120, locale ≤5 — 그 외 필드는 strict()가 거부)
  const parsed = funnelEventPayloadSchema.safeParse(json);
  if (!parsed.success) return bad(400, "잘못된 요청");
  const { event, name, locale } = parsed.data;

  // 4) 익명 저장 (IP·쿠키·UA 없음). cli_events 재사용 — created_at은 서버가 부여.
  //    logFunnelEvent는 fire-and-forget(실패해도 throw 안 함) → 아래는 절대 500나지 않는다.
  //    cli_events.event는 text 컬럼 → web_start_level도 그대로 저장. FunnelEventInput 유니온은
  //    lib/db(수정 금지)에 고정돼 있어 경계에서 캐스트로 브리지한다(런타임 안전).
  await db.logFunnelEvent({ event: EVENT_MAP[event] as FunnelEventInput["event"], name, locale });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export function GET() {
  return bad(405, "POST만 허용");
}
