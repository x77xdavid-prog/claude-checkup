// public/whats-new.json 생성 — catalog.json의 git 이력에서 각 스킬의 최초 등장(addedAt)을 유도.
// 초기 베이스라인(가장 오래된 커밋) 배치는 "신규"에서 제외하고, 현재 카탈로그에 남아있는 것만 담는다.
// Vercel은 shallow clone이라 이력이 없음 → 이 스크립트는 로컬에서 돌려 결과를 커밋한다(catalog.json과 동일 패턴).
// npm run build 는 이 스크립트를 부르지 않는다(커밋된 whats-new.json이 진실 소스). 카탈로그 변경 후 필요할 때 수동 실행.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CATALOG_PATH = "public/catalog.json";
const OUT_PATH = resolve(process.cwd(), "public/whats-new.json");
const MAX_ITEMS = 100;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function catalogCommits() {
  const out = git(["log", "--reverse", "--format=%H|%cI", "--", CATALOG_PATH]).trim();
  if (!out) return [];
  return out.split("\n").map((l) => {
    const [hash, date] = l.split("|");
    return { hash, date };
  });
}

function namesAt(hash) {
  let text;
  try {
    text = git(["show", `${hash}:${CATALOG_PATH}`]);
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return null;
    return new Set(data.map((e) => String(e?.name ?? "")).filter(Boolean));
  } catch {
    return null;
  }
}

function currentCatalog() {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), CATALOG_PATH), "utf8"));
  const byName = new Map();
  for (const e of data) if (e?.name) byName.set(e.name, e);
  return byName;
}

function main() {
  const commits = catalogCommits();
  if (commits.length === 0) {
    console.error("build-whats-new: catalog.json 이력이 없습니다 (shallow clone?). 중단.");
    process.exit(1);
  }
  const baselineDate = commits[0].date;
  const firstSeen = new Map();
  for (const { hash, date } of commits) {
    const names = namesAt(hash);
    if (!names) continue;
    for (const name of names) if (!firstSeen.has(name)) firstSeen.set(name, date);
  }
  const current = currentCatalog();
  const items = [];
  for (const [name, addedAt] of firstSeen) {
    if (addedAt === baselineDate) continue;
    const entry = current.get(name);
    if (!entry) continue;
    items.push({ name, category: entry.category ?? null, source: entry.source ?? null, addedAt });
  }
  items.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : a.name.localeCompare(b.name)));
  const capped = items.slice(0, MAX_ITEMS);
  const generatedAt = commits[commits.length - 1].date;
  writeFileSync(OUT_PATH, JSON.stringify({ generatedAt, count: capped.length, items: capped }, null, 1) + "\n", "utf8");
  console.log(`build-whats-new: ${capped.length}종 (베이스라인 ${baselineDate} 이후) → public/whats-new.json`);
}

main();
