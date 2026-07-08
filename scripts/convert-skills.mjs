#!/usr/bin/env node
// 멀티툴 스킬 변환기 PoC — agency-agents(msitarzewski) convert.sh 패턴을 Node로 이식.
// 우리는 스킬 본문을 소유하지 않으므로, 이건 "사용자 로컬에 설치된 스킬을 변환"하는 CLI다
// (카탈로그/사이트에는 영향 없음 — data/tools.json 계약만 소비).
// name/description 파싱은 skill-parse.mjs의 parseFront 단일 소스 재사용(build-catalog.mjs·
// ingest-external.mjs와 동일 — 규칙을 두 곳에 두면 드리프트 생김).
//
// 실행: node scripts/convert-skills.mjs --src <skillsDir> --tool <cursor|codex> --out <outDir>
//         [--skill <slug>] [--self-test]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFront } from "./skill-parse.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ── 순수 함수 (fs 접근 없음 — self-test가 이 함수들만 합성 데이터로 검증) ──────────

// SKILL.md에서 frontmatter 블록을 뗀 나머지(본문). parseFront와 동일한 경계 정규식으로
// 블록 끝을 찾은 뒤, 닫는 "---" 줄의 개행 하나만 벗긴다(본문 내 의도된 빈 줄은 보존).
function extractBody(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return text;
  return text.slice(m[0].length).replace(/^\r?\n/, "");
}

// YAML 이중따옴표 스칼라. 개행·따옴표·백슬래시를 escape해 반드시 한 줄로 유지한다
// (raw 개행이 들어가면 flow scalar가 깨져 뒤 필드(globs/alwaysApply)를 삼켜버림).
function yamlDoubleQuote(str) {
  const escaped = String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

// TOML 기본 문자열(basic string) escape. 따옴표·백슬래시·제어문자를 전부 \uXXXX 한 규칙으로
// 통일(표준 \" \\ 대신 하나의 규칙 — 파서 결과는 동일, 줄 안에 raw 개행이 남지 않음을 보장).
function escapeToml(str) {
  return String(str).replace(/[\\"\x00-\x1f\x7f]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

// cursor .mdc: description/globs/alwaysApply만 frontmatter에 싣는다(name은 파일명이 곧
// 식별자 — 실제 Cursor rule 관례와 동일). 본문은 그대로("본문 유지" 규격).
function renderCursor({ slug, description, body }) {
  const fm = ["---", `description: ${yamlDoubleQuote(description)}`, "globs: []", "alwaysApply: false", "---", ""].join("\n");
  return { filename: `${slug}.mdc`, content: fm + body };
}

// codex TOML: name/description/developer_instructions(본문) 3키, 전부 basic string.
// 멀티라인 본문도 escapeToml이 개행 문자를 유니코드 이스케이프로 접어 안전한 한 줄 문자열로 만든다.
function renderCodex({ slug, name, description, body }) {
  const lines = [
    `name = "${escapeToml(name)}"`,
    `description = "${escapeToml(description)}"`,
    `developer_instructions = "${escapeToml(body)}"`,
  ];
  return { filename: `${slug}.toml`, content: lines.join("\n") + "\n" };
}

const RENDERERS = { "cursor-mdc": renderCursor, "codex-toml": renderCodex };

// ── I/O ────────────────────────────────────────────────────────────────────

// --src 바로 아래 디렉터리 slug 목록(한 단계만 — <skillsDir>/<slug>/SKILL.md 형식 전제).
// 심볼릭/숨김 디렉터리는 무시.
function listSkillDirs(srcDir) {
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (err) {
    console.error(`FAIL: --src 디렉터리를 읽을 수 없음 (${err.message})`);
    process.exit(1);
  }
  return entries
    .filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

// 스킬 1개 변환. SKILL.md 없으면 skip(카운트만). name 없으면 slug를 이름으로 사용.
function convertSkill(srcDir, slug, renderer) {
  const skillPath = path.join(srcDir, slug, "SKILL.md");
  if (!fs.existsSync(skillPath)) return { status: "skip" };
  const text = fs.readFileSync(skillPath, "utf8");
  const fm = parseFront(text);
  const name = (fm.name || slug).trim() || slug;
  const description = (fm.description || "").trim();
  const body = extractBody(text);
  const { filename, content } = renderer({ slug, name, description, body });
  return { status: "ok", filename, content };
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { src: null, tool: null, out: null, skill: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src") out.src = argv[++i];
    else if (a === "--tool") out.tool = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--skill") out.skill = argv[++i];
  }
  return out;
}

// ── 자가 테스트: fs 없이 까다로운 합성 스킬로 두 렌더러를 검증 ───────────────────

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error("FAIL self-test: " + msg);
  };

  // 따옴표·백슬래시·개행·한글이 섞인 까다로운 케이스.
  const tricky = {
    slug: "tricky-skill",
    name: '따옴표"포함" 이름',
    description: '한 줄 설명 "인용구" 포함\n둘째 줄 \\역슬래시\\ 그리고 한글 설명입니다.',
    body: '# 제목\n\n본문 내용 "그대로" 유지되어야 함.\n',
  };

  // cursor-mdc
  const cur = renderCursor(tricky);
  assert(cur.filename === "tricky-skill.mdc", "cursor 파일명 = slug.mdc");
  const curLines = cur.content.split("\n");
  assert(curLines[0] === "---", "cursor: frontmatter 여는 ---");
  assert(curLines[1].startsWith('description: "'), "cursor: description 필드 존재");
  assert(curLines[1].includes('\\"'), "cursor: 따옴표가 이스케이프됨");
  assert(curLines[1].includes("\\n"), "cursor: 개행이 이스케이프됨(한 줄 유지)");
  assert(curLines[2] === "globs: []", "cursor: globs 필드");
  assert(curLines[3] === "alwaysApply: false", "cursor: alwaysApply 필드");
  assert(curLines[4] === "---", "cursor: frontmatter 닫는 --- (description이 한 줄이었다는 증거)");
  assert(cur.content.endsWith(tricky.body), "cursor: 본문이 비이스케이프 원문 그대로 보존됨");

  // codex-toml
  const cod = renderCodex(tricky);
  assert(cod.filename === "tricky-skill.toml", "codex 파일명 = slug.toml");
  const codLines = cod.content.split("\n").filter((l) => l.length > 0);
  assert(codLines.length === 3, "codex: 정확히 3줄(name/description/developer_instructions) — raw 개행 없음");
  const tomlLineRe = (key) => new RegExp(`^${key} = "([^"\\\\]|\\\\.)*"$`);
  assert(tomlLineRe("name").test(codLines[0]), "codex: name이 유효한 TOML basic string");
  assert(tomlLineRe("description").test(codLines[1]), "codex: description이 유효한 TOML basic string");
  assert(tomlLineRe("developer_instructions").test(codLines[2]), "codex: developer_instructions이 유효한 TOML basic string");
  assert(codLines[0].includes("\\u0022"), "codex: name의 따옴표가 \\uXXXX로 이스케이프");
  assert(codLines[1].includes("\\u000a"), "codex: description의 개행이 \\uXXXX로 이스케이프");
  assert(codLines[2].includes("\\u0022"), "codex: body의 따옴표가 \\uXXXX로 이스케이프");
  assert(!cod.content.includes('"그대로"'), "codex: 원문 raw 따옴표가 이스케이프 없이 남아있지 않음");

  // 엣지케이스: 빈 description도 크래시 없이 안전 처리.
  const empty = { slug: "no-desc", name: "no-desc", description: "", body: "본문만 있음\n" };
  assert(renderCursor(empty).content.includes('description: ""'), "cursor: 빈 description 처리");
  assert(renderCodex(empty).content.includes('description = ""'), "codex: 빈 description 처리");

  console.log("convert-skills.mjs self-test OK");
}

// ── 메인 ───────────────────────────────────────────────────────────────────

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.src || !args.tool || !args.out) {
    console.error("사용법: node scripts/convert-skills.mjs --src <skillsDir> --tool <cursor|codex> --out <outDir> [--skill <slug>] [--self-test]");
    process.exit(1);
  }

  let tools;
  try {
    tools = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tools.json"), "utf8"));
  } catch (err) {
    console.error(`FAIL: data/tools.json을 읽을 수 없음 (${err.message})`);
    process.exit(1);
  }

  const toolCfg = tools[args.tool];
  const renderer = toolCfg && RENDERERS[toolCfg.format];
  if (!renderer) {
    console.error(`FAIL: --tool "${args.tool}" 변환 미지원 (cursor|codex만 가능 — claude-code는 format=identity라 변환이 필요 없습니다)`);
    process.exit(1);
  }

  const slugs = args.skill ? [args.skill] : listSkillDirs(args.src);
  fs.mkdirSync(args.out, { recursive: true });

  let converted = 0;
  let skipped = 0;
  for (const slug of slugs) {
    const result = convertSkill(args.src, slug, renderer);
    if (result.status === "skip") {
      skipped++;
      continue;
    }
    fs.writeFileSync(path.join(args.out, result.filename), result.content, "utf8");
    converted++;
  }
  console.log(`converted ${converted}, skipped ${skipped} → ${args.out}`);
}

main();
