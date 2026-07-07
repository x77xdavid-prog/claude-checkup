#!/usr/bin/env node
// 스킬 카탈로그 생성기 — 로컬 설치물(skills/commands/plugins)을 스캔해 public/catalog.json 생성.
// 실행: node scripts/build-catalog.mjs
// frontmatter 파서는 chip_desc_inject.py의 로직을 Node로 이식(멀티라인 |/> 처리, [1:] 픽스 포함).

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const ROOTS = [
  { dir: path.join(HOME, ".claude", "skills"), kind: "local" },
  { dir: path.join(HOME, ".claude", "commands"), kind: "local" },
  { dir: path.join(HOME, ".claude", "plugins", "marketplaces"), kind: "marketplace" },
];

const PRUNE = new Set(["node_modules", ".git", "assets", "references", "dist", "evals", "tests"]);
const DESC_MAX = 300;

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

  return { name, description: description.slice(0, DESC_MAX), source, install };
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
  const outDir = path.join(here, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "catalog.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 1), "utf8");

  const bySource = {};
  for (const e of catalog) bySource[e.source] = (bySource[e.source] || 0) + 1;
  console.log(`catalog.json 생성: ${outPath}`);
  console.log(`항목 ${catalog.length}개 (스캔 파일 ${scanned}개, 중복 제거 후)`);
  console.log("소스별:", JSON.stringify(bySource, null, 1));
}

main();
