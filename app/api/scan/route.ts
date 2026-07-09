// POST /api/scan — 스캐너 결과 수신 (스펙 §3, §6).
// 계약: {v,totals,flags,categories} → 검증 → 서버 총점 재계산 → 저장 → {id,url}.

import { NextResponse } from "next/server";
import { scanPayloadSchema } from "@/lib/schema";
import { computeTotal, clampScore, type Category } from "@/lib/score";
import { db, type ScanMeta } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs"; // crypto.randomUUID + 인메모리 저장에 node 런타임 고정

const MAX_BYTES = 32 * 1024; // 스펙 §6: 32KB 제한

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  // 1) 레이트리밋 (분당 5회)
  const ip = clientIp(req.headers);
  const rl = await rateLimit("scan", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 2) 바이트 크기 제한 (파싱 전, 원문 기준). 신뢰 경계.
  const raw = await req.text();
  if (raw.length === 0) return bad(400, "빈 요청");
  // JS 문자열 길이 != 바이트지만, 상한 방어로는 바이트가 정확. UTF-8 바이트로 측정.
  const byteLen = new TextEncoder().encode(raw).length;
  if (byteLen > MAX_BYTES) return bad(413, "페이로드가 너무 큽니다 (32KB 초과)");

  // 3) JSON 파싱
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return bad(400, "JSON 형식 오류");
  }

  // 4) zod 스키마 검증
  const parsed = scanPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return bad(422, "검증 실패: " + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  }
  const data = parsed.data;

  // 5) 총점 서버 재계산 (클라이언트 신뢰 금지 — 스펙 §5)
  const categories: Category[] = data.categories.map((c) => ({
    key: c.key,
    label: c.label,
    score: clampScore(c.score),
    verdict: c.verdict,
  }));
  const scoreTotal = computeTotal(categories);

  // 6) meta는 개수·불리언만 (스펙 §4: 개인정보 최소화)
  const meta: ScanMeta = {
    v: data.v,
    totals: data.totals,
    flags: data.flags,
  };

  // 7) 저장 → {id,url}
  const record = await db.saveScan({ scoreTotal, categories, meta });
  return NextResponse.json({ id: record.id, url: `/result/${record.id}` }, { status: 200 });
}

// GET 등은 405
export function GET() {
  return bad(405, "POST만 허용");
}
