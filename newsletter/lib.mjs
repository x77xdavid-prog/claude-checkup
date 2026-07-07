// 뉴스레터 엔진 공통 유틸 — 의존성 제로, node 18+ 내장만.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../newsletter
export const ROOT = dirname(HERE); // 프로젝트 루트
export const DATA_DIR = join(HERE, "data"); // newsletter/data
export const DIGEST_DIR = join(ROOT, "digests"); // digests/

// 로컬 날짜 기준 YYYY-MM-DD (UTC 아님 — 사용자 하루 경계와 맞춤)
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dataPath(day = todayStr()) {
  return join(DATA_DIR, `${day}.json`);
}

export function digestPath(day = todayStr()) {
  return join(DIGEST_DIR, `${day}.html`);
}

// 최소 자가검증: 날짜 포맷 + 경로 파생이 깨지면 즉시 실패.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("lib.mjs")) {
  const { strict: assert } = await import("node:assert");
  assert.equal(todayStr(new Date(2026, 6, 7)), "2026-07-07"); // month는 0-index
  assert.ok(dataPath("2026-07-07").endsWith("2026-07-07.json"));
  assert.ok(digestPath("2026-07-07").endsWith("2026-07-07.html"));
  console.log("lib.mjs self-check OK");
}
