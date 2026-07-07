// GET /api/sample-prompts/[name]
// 스킬명 → public/sample-prompts/<파일명>.json 반환.
// 보안(신뢰 경계): ① 경로순회 차단(.. / \ NUL) ② 화이트리스트(catalog.json 실존 스킬명만)
//                 ③ 디렉터리 봉쇄 재확인. 셋 다 통과해야 파일을 읽는다.
// 파일명 규칙: 스킬명의 :,/ → __ 치환 + .json (파일 생성 스크립트와 대칭).

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadCatalog } from "@/lib/catalog";

export const runtime = "nodejs"; // fs 읽기 → node 런타임 고정

const DIR = path.join(process.cwd(), "public", "sample-prompts");
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

// 스킬명 → 파일명. : 와 / 를 __ 로(생성 규칙과 동일). / 는 아래 순회가드가 먼저 막지만 대칭 유지.
function toFilename(name: string): string {
  return name.replace(/[:/]/g, "__") + ".json";
}

// 순회 위험 문자가 없는가 — 신뢰 경계 1차 방어.
function isSafeName(name: string): boolean {
  return !!name && !name.includes("..") && !name.includes("/") && !name.includes("\\") && !name.includes("\0");
}

// catalog.json 실존 스킬명 집합(화이트리스트). 프로세스 수명 동안 1회 로드 후 캐시.
let nameSetPromise: Promise<Set<string>> | null = null;
function catalogNames(): Promise<Set<string>> {
  if (!nameSetPromise) {
    nameSetPromise = loadCatalog().then((items) => new Set((items ?? []).map((s) => s.name)));
  }
  return nameSetPromise;
}

function err(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params; // Next가 이미 URL 디코드한 단일 세그먼트

  // 1) 경로순회 차단
  if (!isSafeName(name)) return err("invalid name", 400);

  // 2) 화이트리스트 — 실존 스킬명만
  const names = await catalogNames();
  if (!names.has(name)) return err("unknown skill", 404);

  // 3) 디렉터리 봉쇄 재확인(이중 방어)
  const file = path.join(DIR, toFilename(name));
  const rel = path.relative(DIR, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return err("invalid name", 400);

  let text: string;
  try {
    text = await fs.readFile(file, "utf-8");
  } catch {
    return err("not found", 404);
  }
  try {
    return NextResponse.json(JSON.parse(text), { status: 200, headers: { "Cache-Control": CACHE } });
  } catch {
    return err("corrupt file", 500);
  }
}
