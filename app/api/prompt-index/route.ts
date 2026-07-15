// GET /api/prompt-index
// public/sample-prompts/*.json 전체 → { 스킬명: 예문 전문(소문자) } 맵 반환.
// 카탈로그 검색이 예문(샘플 프롬프트) 본문까지 매칭하기 위한 검색 인덱스 —
// 키는 파일 안의 name 필드(클라이언트가 s.name으로 조회), 값은 prompts.join("\n").toLowerCase().
// 모듈 스코프 캐시: 프로세스(람다 웜) 수명 동안 1회만 빌드. 파일 하나가 깨져도
// 개별 스킵(전체 실패 금지) — 해당 스킬만 예문 검색에서 빠질 뿐.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs"; // fs 읽기 → node 런타임 고정

const DIR = path.join(process.cwd(), "public", "sample-prompts");
const CACHE = "public, max-age=3600, stale-while-revalidate=86400";

// 인덱스 빌드 프라미스 캐시 — 동시 요청도 1회 빌드 공유. 실패 시 null로 되돌려 다음 요청에서 재시도.
let indexPromise: Promise<Record<string, string>> | null = null;

async function buildIndex(): Promise<Record<string, string>> {
  const index: Record<string, string> = {};
  const files = await fs.readdir(DIR);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(DIR, f), "utf-8")) as {
        name?: unknown;
        prompts?: unknown;
      };
      if (typeof parsed.name !== "string" || !parsed.name || !Array.isArray(parsed.prompts)) continue;
      const prompts = parsed.prompts.filter((p): p is string => typeof p === "string");
      if (prompts.length === 0) continue;
      index[parsed.name] = prompts.join("\n").toLowerCase();
    } catch {
      // 깨진 파일은 스킵 — 인덱스 전체를 죽이지 않는다.
    }
  }
  return index;
}

export async function GET() {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((e) => {
      indexPromise = null; // 실패는 캐시하지 않음 — 다음 요청에서 재빌드 시도
      throw e;
    });
  }
  try {
    const index = await indexPromise;
    return NextResponse.json(index, { status: 200, headers: { "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json({ error: "index build failed" }, { status: 500 });
  }
}
