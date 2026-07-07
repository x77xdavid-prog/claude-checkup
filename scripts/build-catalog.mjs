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

const HOME = os.homedir();
const ROOTS = [
  { dir: path.join(HOME, ".claude", "skills"), kind: "local" },
  { dir: path.join(HOME, ".claude", "commands"), kind: "local" },
  { dir: path.join(HOME, ".claude", "plugins", "marketplaces"), kind: "marketplace" },
];

const PRUNE = new Set(["node_modules", ".git", "assets", "references", "dist", "evals", "tests"]);
const DESC_MAX = 300;

// ── 카테고리 분류 규칙 ────────────────────────────────────────────────────────
// name+description 소문자 매칭. 순서대로 첫 매치 승 — 순서 절대 변경 금지(스펙 표).
// name<2자 / 한글 자모(ㅇㅇ)여도 제외하지 않고 매치 없으면 "기타".
const CATEGORY_RULES = [
  ["프로젝트 관리", /^gsd-/],
  ["보안", /secur|vuln|vibesec|pentest|owasp/],
  ["자동화·스케줄", /schedul|loop|cron|hookify|automat|routine/],
  ["오케스트레이션·에이전트", /autopilot|ralph|ultrawork|ultra|team|orchestr|agent|swarm|workflow|multi-|pipeline/],
  ["테스트·디버깅", /test|tdd|debug|e2e|\bqa\b|coverage|verif/],
  ["리뷰·품질", /review|lint|slop|simplif|refactor|clean|quality|critic/],
  ["프론트엔드·디자인", /design|\bui\b|\bux\b|frontend|css|gsap|three|animat|font|tailwind|component|landing|hero/],
  ["배포·운영", /ship|deploy|release|\bci\b|docker|build|git|github|pm2|monitor/],
  ["마케팅·SEO", /seo|marketing|\bads?\b|email|copywrit|content|social|aso|cro|offer|pricing|brand|newsletter|outreach/],
  ["데이터·분석", /data|sql|analy|chart|viz|stat|dashboard|scrape/],
  ["문서·글쓰기", /docs?|write|writing|pdf|pptx|docx|xlsx|readme|wiki|document/],
  ["검색·리서치", /search|research|fetch|crawl|browse|lookup|insane/],
  ["금융·결제", /pay|finance|stock|crypto|invest|reconcil|journal|sox/],
];
const CATEGORY_FALLBACK = "기타";

// name+description 소문자 하나로 합쳐 첫 매치 규칙의 카테고리 반환.
function classify(name, description) {
  const hay = `${name} ${description}`.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(hay)) return cat;
  }
  return CATEGORY_FALLBACK;
}

// ── frontmatter 파서 (파이썬 parse_front 이식) ───────────────────────────────

function parseFront(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const out = {};
  for (const key of ["name", "description"]) {
    const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
    const km = re.exec(fm);
    if (!km) continue;
    let val = km[1].trim();
    if ([">", ">-", "|", "|-", ""].includes(val)) {
      // 멀티라인 블록: 마커 라인 다음 줄부터 들여쓰기가 유지되는 동안 수집.
      // [1:] 픽스 — slice(0)은 마커 라인의 잔여 빈 문자열이므로 건너뜀.
      const rest = fm.slice(km.index + km[0].length).split("\n").slice(1);
      const lines = [];
      for (const ln of rest) {
        if (/^\s+\S/.test(ln)) lines.push(ln.trim());
        else break;
      }
      val = lines.join(" ");
    }
    out[key] = val.replace(/^["' ]+|["' ]+$/g, "");
  }
  return out;
}

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

// ── 자가 체크: 파서가 깨지면 여기서 즉시 실패 ─────────────────────────────────

function selfCheck() {
  const plain = parseFront('---\nname: foo\ndescription: hello world\n---\nbody');
  console.assert(plain.name === "foo" && plain.description === "hello world", "plain fm");
  const multi = parseFront("---\nname: bar\ndescription: |\n  line one\n  line two\nother: x\n---\n");
  console.assert(multi.description === "line one line two", "multiline | fm: " + multi.description);
  const folded = parseFront("---\ndescription: >-\n  a\n  b\n---\n");
  console.assert(folded.description === "a b", "folded >- fm");
  console.assert(Object.keys(parseFront("no frontmatter")).length === 0, "no fm");
  const mi = marketInfo("official/plugins/myplugin/skills/x/SKILL.md");
  console.assert(mi.market === "official" && mi.plugin === "myplugin", "marketInfo");
  // 분류 순서 규칙 — 순서 의존 케이스가 깨지면 즉시 실패.
  console.assert(classify("gsd-ship", "deploy to prod") === "프로젝트 관리", "gsd 우선");
  console.assert(classify("vibesec", "security audit") === "보안", "보안");
  console.assert(classify("ralph-loop", "orchestrate") === "자동화·스케줄", "loop가 오케보다 앞");
  console.assert(classify("autopilot", "run agents") === "오케스트레이션·에이전트", "오케");
  console.assert(classify("ㅇㅇ", "clipboard paste") === CATEGORY_FALLBACK, "자모→기타");
  console.assert(classify("zzz", "") === CATEGORY_FALLBACK, "무매치→기타");
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

  const catalog = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const here = path.dirname(fileURLToPath(import.meta.url));

  // provenance 조인 → 각 항목에 install2 부여(파일 없으면 스킵).
  const provPath = path.join(here, "..", "data", "provenance.json");
  const install2Dist = joinInstall2(catalog, provPath);

  const outDir = path.join(here, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "catalog.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 1), "utf8");

  const bySource = {};
  for (const e of catalog) bySource[e.source] = (bySource[e.source] || 0) + 1;
  console.log(`catalog.json 생성: ${outPath}`);
  console.log(`항목 ${catalog.length}개 (스캔 파일 ${scanned}개, 중복 제거 후)`);
  console.log("소스별:", JSON.stringify(bySource, null, 1));
  if (install2Dist) {
    console.log("install2 분포:", JSON.stringify(install2Dist));
  } else {
    console.log("install2: provenance.json 없음 → 조인 스킵");
  }

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
