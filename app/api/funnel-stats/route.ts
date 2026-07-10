// GET /api/funnel-stats?days=7 — 웹 퍼널 집계 조회(#48 대시보드의 데이터 기반 + 향후 "인기순" 정렬의 원천).
// cli_events(cli_version="web")를 읽어 4종 이벤트(install_copy/prompt_copy/mcp_copy/start_level)를 집계한다.
// 쓰기 없음, PII 없음(집계 카운트만 반환 — created_at조차 반환하지 않는다). 읽기 전용 GET만 export.
// 어댑터(db.listFunnelEvents)는 원시 행(event·value)만 반환하고, 집계는 여기(route)에서 순수 함수로 수행한다.

import { NextResponse } from "next/server";
import { funnelStatsQuerySchema } from "@/lib/schema";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_N = 10;
// 집계는 5분 신선도면 충분 — CDN/브라우저가 짧게 캐시하고, 만료 후에도 10분간은 재검증 동안 stale 응답을 내준다.
const CACHE_HEADER = "public, s-maxage=300, stale-while-revalidate=600";

const EVENT_KEYS = ["install_copy", "prompt_copy", "mcp_copy", "start_level"] as const;
type EventKey = (typeof EVENT_KEYS)[number];

const LEVEL_KEYS = ["lv0", "lv1", "lv2", "lv3", "lv4"] as const;
type LevelKey = (typeof LEVEL_KEYS)[number];

interface FunnelStats {
  days: number;
  since: string;
  events: Record<EventKey, number>;
  topInstalls: Array<{ name: string; count: number }>;
  topPrompts: Array<{ name: string; count: number }>;
  levels: Record<LevelKey, number>;
}

function isEventKey(v: string): v is EventKey {
  return (EVENT_KEYS as readonly string[]).includes(v);
}

function isLevelKey(v: string): v is LevelKey {
  return (LEVEL_KEYS as readonly string[]).includes(v);
}

function topN(counts: Map<string, number>): Array<{ name: string; count: number }> {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([name, count]) => ({ name, count }));
}

// 원시 행(event="web_"+종류, value=name) → 집계. web_ 접두사 제거 후 정의된 4종 외 이벤트는 무시.
// 순수 함수 — DB·네트워크 접근 없음(테스트 용이성 + route 밖으로 로직 유출 방지).
function aggregateFunnelStats(rows: Array<{ event: string; value: string }>, days: number, since: string): FunnelStats {
  const events: Record<EventKey, number> = { install_copy: 0, prompt_copy: 0, mcp_copy: 0, start_level: 0 };
  const levels: Record<LevelKey, number> = { lv0: 0, lv1: 0, lv2: 0, lv3: 0, lv4: 0 };
  const installCounts = new Map<string, number>();
  const promptCounts = new Map<string, number>();

  for (const row of rows) {
    if (!row.event.startsWith("web_")) continue; // cli_version='web' 필터를 신뢰하되 이중 방어
    const key = row.event.slice(4); // "web_" 제거
    if (!isEventKey(key)) continue; // 정의된 4종 외 이벤트는 무시
    events[key] += 1;

    const name = row.value.trim();
    if (name === "") continue; // 빈 문자열 제외(순위·레벨 분포 대상에서만 — 위 카운트는 이미 반영됨)
    if (key === "install_copy") installCounts.set(name, (installCounts.get(name) ?? 0) + 1);
    else if (key === "prompt_copy") promptCounts.set(name, (promptCounts.get(name) ?? 0) + 1);
    else if (key === "start_level" && isLevelKey(name)) levels[name] += 1;
  }

  return { days, since, events, topInstalls: topN(installCounts), topPrompts: topN(promptCounts), levels };
}

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, data: null, error }, { status });
}

export async function GET(req: Request) {
  // 1) 레이트리밋 (분당 10회) — ip는 카운트 키로만 쓰고 저장하지 않음.
  const ip = clientIp(req.headers);
  const rl = await rateLimit("stats", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, data: null, error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 2) 쿼리 검증 (days: 1~30 정수, 기본 7 — 그 외 필드는 strict()가 거부)
  const url = new URL(req.url);
  const parsed = funnelStatsQuerySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
  if (!parsed.success) return bad(400, "잘못된 요청");
  const { days } = parsed.data;
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  // 3) 조회(어댑터는 원시 행만) + 집계(순수 함수). 실패 시 내부 메시지는 서버 로그로만, 응답은 일반 메시지.
  try {
    const rows = await db.listFunnelEvents(since);
    const stats = aggregateFunnelStats(rows, days, since);
    return NextResponse.json({ ok: true, data: stats, error: null }, { status: 200, headers: { "Cache-Control": CACHE_HEADER } });
  } catch (e) {
    console.error("funnel-stats 조회 실패:", e instanceof Error ? e.message : String(e));
    return bad(500, "통계를 불러오지 못했습니다.");
  }
}
