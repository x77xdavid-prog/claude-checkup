#!/usr/bin/env node
// checkup-skills — claudecowork.co.kr 카탈로그(977+종) 검색 CLI. 외부 의존 없음(Node 18+ 내장 fetch만).
//
// 사용:
//   checkup-skills <검색어…>     이름/설명/카테고리 부분일치 검색, 상위 10건
//   checkup-skills info <이름>   정확 일치 1건 상세
//   checkup-skills --version     버전
//   checkup-skills --help        도움말
//   checkup-skills --self-test   검색/포매터 순수 함수를 합성 데이터로 검증 (네트워크 없음)

import fs from "node:fs";

const CATALOG_URL = "https://claudecowork.co.kr/catalog.json";
const SITE_URL = "https://claudecowork.co.kr";
const MAX_RESULTS = 10;
const DESC_MAX = 80;

// ── 색상 (NO_COLOR 존중, TTY 아니면 비활성) ──────────────────────────────────

function useColor() {
  return !("NO_COLOR" in process.env) && !!process.stdout.isTTY;
}

function bold(text) {
  return useColor() ? `\x1b[1m${text}\x1b[0m` : text;
}

// ── 순수 함수들 (fs/network 없음 — --self-test가 이 함수들만 합성 데이터로 검증) ──

// name/description/category 각각에 대해 대소문자 무시 부분일치 (필드 경계를 넘어 오검색되지 않도록 필드별로 검사).
function fieldMatches(entry, q) {
  const name = String(entry?.name ?? "").toLowerCase();
  const desc = String(entry?.description ?? "").toLowerCase();
  const cat = String(entry?.category ?? "").toLowerCase();
  return name.includes(q) || desc.includes(q) || cat.includes(q);
}

export function filterCatalog(catalog, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [];
  return catalog.filter((entry) => fieldMatches(entry, q));
}

export function truncate(str, max) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

// install2.command가 있으면 줄 단위로 분리해 반환, 없으면 note, 둘 다 없으면 정직한 안내 문구.
export function installLines(entry) {
  const i2 = entry?.install2;
  if (i2 && typeof i2.command === "string" && i2.command.trim()) {
    return i2.command.split("\n");
  }
  if (i2 && typeof i2.note === "string" && i2.note.trim()) {
    return [i2.note];
  }
  return [`설치 명령이 제공되지 않습니다. 사이트에서 확인하세요: ${SITE_URL}`];
}

// info 명령용 — 이름 정확 일치(대소문자 무시, 카탈로그에 중복 name 없음을 전제).
export function findExact(catalog, name) {
  const target = String(name ?? "").trim().toLowerCase();
  if (!target) return null;
  return catalog.find((e) => String(e?.name ?? "").toLowerCase() === target) ?? null;
}

export function formatResultLine(entry, rank) {
  const cat = entry.category ? ` [${entry.category}]` : "";
  const lines = [`${rank}. ${bold(entry.name)}${cat}`, `   ${truncate(entry.description, DESC_MAX)}`];
  const install = installLines(entry);
  lines.push(`   설치: ${install[0]}`);
  for (let i = 1; i < install.length; i++) {
    lines.push(`         ${install[i]}`);
  }
  return lines;
}

export function formatSummary(query, total, shown) {
  if (total === 0) {
    return `검색 결과 없음: "${query}" (0건) — 다른 검색어를 시도하거나 ${SITE_URL} 에서 둘러보세요.`;
  }
  return `전체 ${total}건 중 ${shown}건 — 자세히: ${SITE_URL}`;
}

export function formatInfoBlock(entry) {
  const cat = entry.category ? ` [${entry.category}]` : "";
  const lines = [`■ ${bold(entry.name)}${cat}`];
  if (entry.collection) lines.push(`컬렉션: ${entry.collection}`);
  lines.push(`출처: ${entry.source ?? "미상"}`);
  lines.push(`라이선스: ${entry.install2?.license || "미상"}`);
  lines.push("");
  lines.push(entry.description ?? "");
  lines.push("");
  lines.push("설치 명령:");
  for (const l of installLines(entry)) lines.push(`  ${l}`);
  return lines;
}

export function helpText() {
  return [
    `checkup-skills — Claude Code 스킬 카탈로그 검색 CLI (977+종)`,
    "",
    "사용법:",
    "  checkup-skills <검색어…>       이름·설명·카테고리에서 검색 (상위 10건)",
    "  checkup-skills info <이름>     스킬 상세 정보 (정확 일치)",
    "  checkup-skills --version       버전 출력",
    "  checkup-skills --help          도움말",
    "",
    "예시:",
    "  checkup-skills commit",
    "  checkup-skills info glass-dark-ui",
    "",
    `전체 카탈로그: ${SITE_URL}`,
  ].join("\n");
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function fetchCatalog() {
  let res;
  try {
    res = await fetch(CATALOG_URL);
  } catch (err) {
    throw new Error(`카탈로그를 불러올 수 없습니다 (네트워크 오류): ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`카탈로그를 불러올 수 없습니다 (HTTP ${res.status})`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`카탈로그 JSON 파싱에 실패했습니다: ${err.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("카탈로그 형식이 올바르지 않습니다 (배열이 아님)");
  }
  return data;
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  return pkg.version;
}

async function runSearch(query) {
  const catalog = await fetchCatalog();
  const matches = filterCatalog(catalog, query);
  const shown = matches.slice(0, MAX_RESULTS);
  const out = [];
  shown.forEach((entry, i) => {
    out.push(...formatResultLine(entry, i + 1));
    out.push("");
  });
  out.push(formatSummary(query, matches.length, shown.length));
  console.log(out.join("\n"));
  return 0;
}

async function runInfo(name) {
  const catalog = await fetchCatalog();
  const entry = findExact(catalog, name);
  if (!entry) {
    console.error(`일치하는 스킬을 찾을 수 없습니다: "${name}"`);
    console.error(`검색해 보세요: checkup-skills ${name}`);
    return 1;
  }
  console.log(formatInfoBlock(entry).join("\n"));
  return 0;
}

// ── 자가 테스트: 검색/포매터 순수 함수를 합성 데이터로 검증 (fs/network 없음) ──

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error("FAIL self-test: " + msg);
  };

  const catalog = [
    {
      name: "glass-dark-ui",
      description: "Build dark-mode glassmorphism interfaces",
      category: "프론트엔드·디자인",
      source: "external:MengTo/Skills",
      collection: "디자인 스킬 (MengTo)",
      install2: { kind: "verified-repo", command: "npx skills add https://x --skill glass-dark-ui", license: "MIT" },
    },
    {
      name: "commit",
      description: "Create a git commit",
      category: "배포·운영",
      source: "plugin:x",
      install2: { kind: "marketplace", command: "/plugin marketplace add x\n/plugin install commit@x" },
    },
    {
      name: "8-bit-orbit-video-template",
      description: "Hyperframes-based video template",
      category: "오케스트레이션·에이전트",
      source: "local",
      install2: { kind: "unverified", command: null, note: "출처 미확인" },
    },
    {
      // name 끝 "abc" + description 시작 "def" — 필드를 이어붙였다면 "abc def"가 거짓으로 매치될 수 있는 경계 케이스.
      name: "widget-abc",
      description: "def-panel renderer",
      category: "기타",
      source: "local",
      install2: { kind: "unverified", command: null },
    },
  ];

  // filterCatalog: 필드별 부분일치.
  assert(filterCatalog(catalog, "glass").length === 1, "name 부분일치를 찾아야 함");
  assert(filterCatalog(catalog, "git commit").length === 1, "description 부분일치를 찾아야 함");
  assert(filterCatalog(catalog, "배포").length === 1, "category 부분일치를 찾아야 함");
  assert(filterCatalog(catalog, "GLASS").length === 1, "대소문자를 무시해야 함");
  assert(filterCatalog(catalog, "없는검색어xyz").length === 0, "매치가 없으면 빈 배열이어야 함");
  assert(filterCatalog(catalog, "").length === 0, "빈 검색어는 빈 배열이어야 함");
  assert(
    filterCatalog(catalog, "abc def").length === 0,
    "필드 경계를 넘어 거짓 매치하면 안 됨 (name 끝 + description 시작 결합 금지)",
  );

  // truncate.
  assert(truncate("짧은문장", 80) === "짧은문장", "80자 이하는 그대로 반환해야 함");
  const long = "a".repeat(100);
  assert(truncate(long, 80).endsWith("…"), "80자 초과 시 말줄임표를 붙여야 함");
  assert(truncate(long, 80).length === 81, "말줄임표 포함 길이는 81(80+…)이어야 함");
  assert(truncate("정확히80자".padEnd(80, "x"), 80).length === 80, "정확히 80자는 자르지 않아야 함");

  // installLines.
  assert(installLines(catalog[1]).length === 2, "개행 포함 명령은 여러 줄로 분리해야 함");
  assert(installLines(catalog[1])[1].includes("commit@x"), "두 번째 줄 내용이 보존돼야 함");
  assert(installLines(catalog[2])[0] === "출처 미확인", "command가 null이면 note를 보여줘야 함");
  assert(
    installLines(catalog[3])[0].includes(SITE_URL),
    "command와 note가 둘 다 없으면 사이트 안내 문구로 대체해야 함",
  );

  // findExact.
  assert(findExact(catalog, "commit")?.name === "commit", "정확한 이름을 찾아야 함");
  assert(findExact(catalog, "COMMIT")?.name === "commit", "대소문자를 무시하고 찾아야 함");
  assert(findExact(catalog, "commi") === null, "부분일치는 실패해야 함 (info는 정확 일치)");
  assert(findExact(catalog, "없음") === null, "없는 이름은 null이어야 함");

  // formatSummary.
  assert(formatSummary("q", 0, 0).includes("0건"), "0건일 때 0건을 명시해야 함");
  const summary = formatSummary("q", 25, 10);
  assert(summary.includes("25건") && summary.includes("10건"), "전체 건수와 표시 건수를 모두 포함해야 함");

  // formatResultLine / formatInfoBlock — 구조와 핵심 텍스트 포함 여부만 확인(색상 여부 무관하게 includes 사용).
  const resultLines = formatResultLine(catalog[0], 1);
  assert(resultLines[0].includes("1.") && resultLines[0].includes("glass-dark-ui"), "결과 줄에 순번·이름 포함");
  assert(resultLines.some((l) => l.includes("Build dark-mode")), "결과 줄에 설명 포함");
  assert(resultLines.some((l) => l.includes("npx skills add")), "결과 줄에 설치 명령 포함");

  const infoLines = formatInfoBlock(catalog[0]);
  assert(infoLines.some((l) => l.includes("MIT")), "info에 라이선스 포함");
  assert(infoLines.some((l) => l.includes("external:MengTo/Skills")), "info에 출처 포함");
  assert(infoLines.some((l) => l.includes("디자인 스킬 (MengTo)")), "info에 컬렉션 포함");

  console.log("checkup-skills self-test OK");
}

// ── 진입점 ────────────────────────────────────────────────────────────────────

async function main(argv) {
  const args = argv.slice(2);

  if (args[0] === "--self-test") {
    selfTest();
    return 0;
  }
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(helpText());
    return 0;
  }
  if (args[0] === "--version") {
    console.log(readVersion());
    return 0;
  }
  if (args[0] === "info") {
    const name = args.slice(1).join(" ").trim();
    if (!name) {
      console.error("오류: info 명령에는 스킬 이름이 필요합니다. 예: checkup-skills info glass-dark-ui");
      return 1;
    }
    return runInfo(name);
  }

  const query = args.join(" ").trim();
  if (!query) {
    console.log(helpText());
    return 0;
  }
  return runSearch(query);
}

main(process.argv)
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((err) => {
    console.error(err?.message ?? String(err));
    process.exitCode = 1;
  });
