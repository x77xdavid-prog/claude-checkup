#!/usr/bin/env node
// 스킬 카탈로그 생성기 — 로컬 설치물(skills/commands/plugins)을 스캔해 public/catalog.json 생성.
// 실행: node scripts/build-catalog.mjs
// frontmatter 파서는 chip_desc_inject.py의 로직을 Node로 이식(멀티라인 |/> 처리, [1:] 픽스 포함).

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 순수 로직은 lib/install-command.ts 단일 소스 재사용(Node24 타입-스트리핑으로 .ts 직접 import).
import { installFor } from "../lib/install-command.ts";
// 파싱·분류는 skill-parse.mjs 단일 소스(ingest-external.mjs와 공유 → 규칙 드리프트 방지).
import { parseFront, classify, CATEGORY_RULES, CATEGORY_FALLBACK, DESC_MAX } from "./skill-parse.mjs";

const HOME = os.homedir();
const ROOTS = [
  { dir: path.join(HOME, ".claude", "skills"), kind: "local" },
  { dir: path.join(HOME, ".claude", "commands"), kind: "local" },
  { dir: path.join(HOME, ".claude", "plugins", "marketplaces"), kind: "marketplace" },
];

const PRUNE = new Set(["node_modules", ".git", "assets", "references", "dist", "evals", "tests"]);
// parseFront·classify·CATEGORY_RULES·CATEGORY_FALLBACK·DESC_MAX는 skill-parse.mjs가 단일 소스(상단 import).

// ── 워크 + 수집 ───────────────────────────────────────────────────────────────

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!PRUNE.has(e.name)) yield* walk(path.join(dir, e.name));
    } else if (e.isFile() && /\.md$/i.test(e.name)) {
      yield path.join(dir, e.name);
    }
  }
}

function readHead(p) {
  try {
    return fs.readFileSync(p, "utf8").slice(0, 8000);
  } catch {
    return "";
  }
}

// 마켓 파일 경로 → { market, plugin } 추정.
// 구조: marketplaces/<market>/(plugins|external_plugins)/<plugin>/... 또는 <market>/skills/... 직접.
function marketInfo(relPath) {
  const segs = relPath.split(/[\\/]/).filter(Boolean);
  const market = segs[0] || "";
  let plugin = null;
  for (let i = 1; i < segs.length - 1; i++) {
    if (segs[i] === "plugins" || segs[i] === "external_plugins") {
      plugin = segs[i + 1] || null;
      break;
    }
  }
  return { market, plugin };
}

function buildEntry(filePath, root) {
  const text = readHead(filePath);
  const fm = parseFront(text);
  const description = (fm.description || "").trim();
  if (!description) return null; // 설명 없는 항목은 카탈로그 가치 없음 (파이썬과 동일)

  const base = path.basename(filePath);
  const isSkill = base.toUpperCase() === "SKILL.MD";
  let name = fm.name || (isSkill ? path.basename(path.dirname(filePath)) : base.replace(/\.md$/i, ""));
  name = name.trim().replace(/^\/+/, "");
  if (!name) return null;

  let source = "local";
  let install = "~/.claude/skills/ 아래에 SKILL.md 복사";
  if (root.kind === "marketplace") {
    const rel = path.relative(root.dir, filePath);
    const { market, plugin } = marketInfo(rel);
    source = `plugin:${market}`;
    install = `/plugin install ${plugin || name}@${market}`;
  }

  const desc = description.slice(0, DESC_MAX);
  return { name, description: desc, category: classify(name, desc), source, install };
}

// ── install2 조인 (정직 원칙) ─────────────────────────────────────────────────
// provenance.json을 각 항목에 조인해 install2(installFor 결과) 필드 추가.
// provenance.json 없으면 스킵(빌드 안 깨짐). unverified 항목엔 같은 category 설치가능 스킬 2개를 대안으로.

// marketplace install 문자열에서 실제 플러그인명 추출(스킬명과 다를 수 있음): "/plugin install <plugin>@<market>"
function parsePlugin(install) {
  const m = /install\s+(\S+)@/.exec(install || "");
  return m ? m[1] : undefined;
}

// catalog(제자리 변형)에 install2 부여. 반환: {kind별 분포} 또는 null(provenance 없음).
function joinInstall2(catalog, provPath) {
  let provenance;
  try {
    provenance = JSON.parse(fs.readFileSync(provPath, "utf8"));
  } catch {
    return null; // provenance.json 없음/손상 → 스킵
  }

  // 1차: 대안 없이 예비 install2 계산(kind·command 확정).
  const prelim = new Map();
  for (const e of catalog) {
    const pluginName = e.source.startsWith("plugin:") ? parsePlugin(e.install) : undefined;
    prelim.set(e.name, installFor(e.name, e.source, { prov: provenance[e.name], pluginName }));
  }

  // category → 설치가능(command!=null) 스킬 이름 목록(대안 후보 풀).
  const installableByCat = new Map();
  for (const e of catalog) {
    if (prelim.get(e.name).command === null) continue;
    const cat = e.category || CATEGORY_FALLBACK;
    if (!installableByCat.has(cat)) installableByCat.set(cat, []);
    installableByCat.get(cat).push(e.name);
  }

  // 2차: unverified엔 같은 category 대안 2개 채워 최종 install2 부여.
  const dist = { marketplace: 0, "verified-repo": 0, unverified: 0 };
  for (const e of catalog) {
    const p = prelim.get(e.name);
    if (p.kind === "unverified") {
      const cat = e.category || CATEGORY_FALLBACK;
      const alts = (installableByCat.get(cat) ?? []).filter((n) => n !== e.name).slice(0, 2);
      e.install2 = installFor(e.name, e.source, { prov: provenance[e.name], alternatives: alts });
    } else {
      e.install2 = p;
    }
    dist[e.install2.kind]++;
  }
  return dist;
}

// ── 외부 컬렉션 병합 ──────────────────────────────────────────────────────────
// data/external/*.json(ingest-external.mjs 산출)을 읽어 병합 후보로 로드.
// 각 항목은 이미 install2·collection 보유. 로컬 name과 겹치면 skip(로컬 우선),
// 외부끼리 겹치면 먼저 온 쪽 유지. 반환: {external: 유지항목[], stats}.
function loadExternal(here, localNames) {
  const dir = path.join(here, "..", "data", "external");
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return { external: [], stats: { files: 0, total: 0, kept: 0, skippedLocal: 0, skippedDup: 0, skippedNames: [] } };
  }
  const seen = new Set();
  const kept = [];
  const skippedNames = [];
  let total = 0,
    skippedLocal = 0,
    skippedDup = 0;
  for (const f of files) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue; // 손상된 캐시 파일은 조용히 스킵(빌드 안 깨짐)
    }
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (!e || typeof e.name !== "string" || !e.name) continue;
      total++;
      if (localNames.has(e.name)) {
        skippedLocal++;
        skippedNames.push(e.name);
        continue; // 로컬 우선
      }
      if (seen.has(e.name)) {
        skippedDup++;
        continue; // 외부 간 중복
      }
      seen.add(e.name);
      kept.push(e);
    }
  }
  return { external: kept, stats: { files: files.length, total, kept: kept.length, skippedLocal, skippedDup, skippedNames } };
}

// 외부 항목을 provenance.json에 반영. method:external-registry, verified:true
// (SKILL.md fetch 성공이 곧 실존 증명). 기존 항목은 보존, 외부 항목만 추가/갱신.
function mergeProvenance(provPath, external) {
  let prov;
  try {
    prov = JSON.parse(fs.readFileSync(provPath, "utf8"));
  } catch {
    prov = {}; // 없으면 새로 생성
  }
  let added = 0;
  for (const e of external) {
    const slug = typeof e.source === "string" && e.source.startsWith("external:") ? e.source.slice("external:".length) : null;
    const i2 = e.install2 || {};
    const entry = { repo: slug ? `https://github.com/${slug}` : null, method: "external-registry", verified: true };
    if (typeof i2.command === "string") entry.install = i2.command;
    if (i2.license) entry.license = i2.license;
    prov[e.name] = entry;
    added++;
  }
  fs.writeFileSync(provPath, JSON.stringify(prov, null, 1), "utf8");
  return added;
}

// ── 자가 체크: 파서가 깨지면 여기서 즉시 실패 ─────────────────────────────────
// parseFront·classify 규칙 검증은 skill-parse.mjs 자가체크가 담당(단일 소스). 여기선 로컬 로직만.

function selfCheck() {
  const mi = marketInfo("official/plugins/myplugin/skills/x/SKILL.md");
  console.assert(mi.market === "official" && mi.plugin === "myplugin", "marketInfo");
  console.assert(classify("vibesec", "security audit") === "보안", "classify 연결 확인");
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

function main() {
  selfCheck();

  const byName = new Map(); // 중복 name → 설명 긴 쪽 유지
  let scanned = 0;
  for (const root of ROOTS) {
    for (const filePath of walk(root.dir)) {
      const entry = buildEntry(filePath, root);
      if (!entry) continue;
      scanned++;
      const prev = byName.get(entry.name);
      if (!prev || entry.description.length > prev.description.length) {
        byName.set(entry.name, entry);
      }
    }
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const localEntries = [...byName.values()];

  // provenance 조인 → 로컬 항목에 install2 부여(파일 없으면 스킵). 외부 항목은 자체 install2 보유.
  const provPath = path.join(here, "..", "data", "provenance.json");
  const install2Dist = joinInstall2(localEntries, provPath);

  // 외부 컬렉션 병합 — data/external/*.json. 로컬과 name 겹치면 skip(로컬 우선).
  const localNames = new Set(localEntries.map((e) => e.name));
  const { external, stats: extStats } = loadExternal(here, localNames);
  // 외부 항목을 provenance.json에 반영(method:external-registry, verified:true).
  const provAdded = external.length ? mergeProvenance(provPath, external) : 0;

  const catalog = [...localEntries, ...external].sort((a, b) => a.name.localeCompare(b.name));

  const outDir = path.join(here, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "catalog.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 1), "utf8");

  const bySource = {};
  for (const e of catalog) bySource[e.source] = (bySource[e.source] || 0) + 1;
  console.log(`catalog.json 생성: ${outPath}`);
  console.log(`항목 ${catalog.length}개 = 로컬 ${localEntries.length} + 외부 ${external.length} (스캔 파일 ${scanned}개)`);
  console.log("소스별:", JSON.stringify(bySource, null, 1));

  // 외부 병합 통계 + 컬렉션 분포.
  if (extStats.files > 0) {
    console.log(
      `외부 병합: 파일 ${extStats.files} · 후보 ${extStats.total} · 유지 ${extStats.kept} · ` +
        `로컬충돌 skip ${extStats.skippedLocal} · 외부중복 skip ${extStats.skippedDup} · provenance 추가 ${provAdded}`,
    );
    if (extStats.skippedNames.length) console.log(`  로컬 우선 skip: ${extStats.skippedNames.join(", ")}`);
    const byCol = {};
    for (const e of catalog) if (e.collection) byCol[e.collection] = (byCol[e.collection] || 0) + 1;
    console.log("컬렉션 분포:", JSON.stringify(byCol));
  } else {
    console.log("외부 병합: data/external/*.json 없음 → 스킵");
  }

  // install2 분포 — 최종 카탈로그 전체(로컬+외부) 기준.
  const i2dist = {};
  for (const e of catalog) i2dist[e.install2 ? e.install2.kind : "none"] = (i2dist[e.install2 ? e.install2.kind : "none"] || 0) + 1;
  console.log("install2 분포:", JSON.stringify(i2dist), install2Dist ? "" : "(provenance 없음 → 로컬 install2 미조인)");

  // 카테고리 분포 — 규칙 표 순서대로(+기타 끝), 개수·비율. "기타" 30% 초과면 경고(규칙은 불변).
  const order = [...CATEGORY_RULES.map(([c]) => c), CATEGORY_FALLBACK];
  const byCat = new Map(order.map((c) => [c, 0]));
  for (const e of catalog) byCat.set(e.category, (byCat.get(e.category) || 0) + 1);
  console.log("카테고리 분포:");
  for (const c of order) {
    const n = byCat.get(c) || 0;
    const pct = catalog.length ? ((n / catalog.length) * 100).toFixed(1) : "0.0";
    console.log(`  ${c.padEnd(14)} ${String(n).padStart(4)}  (${pct}%)`);
  }
  const otherPct = catalog.length ? (byCat.get(CATEGORY_FALLBACK) / catalog.length) * 100 : 0;
  if (otherPct > 30) {
    console.warn(`⚠ "기타" ${otherPct.toFixed(1)}% — 30% 초과. 규칙 순서 점검 필요(규칙 자체는 유지, 보고만).`);
  }
}

main();
