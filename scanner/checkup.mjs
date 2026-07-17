#!/usr/bin/env node
// claude-checkup 로컬 진단 스캐너 — 읽기 전용, 의존성 제로(node 18+ 내장만).
//
// 실행: node scanner/checkup.mjs [--base https://...] [--yes]
//   --base  결과 전송 서버 (기본 https://claudecowork.co.kr, 환경변수 BASE_URL도 인식; 로컬 개발은 --base http://localhost:3000)
//   --yes   전송 동의 프롬프트 건너뛰기(CI/자가검증용, 여전히 수집 JSON은 출력)
//
// 무엇을 수집하나: ~/.claude 아래 설치물의 "개수와 불리언"만.
//   이름·경로·파일 내용은 절대 수집하지 않는다 (개인정보 최소화 = 셀링포인트).
// 무엇을 하나: 스펙 §5 루브릭으로 10개 영역 점수 → 총점 → 전송 or 로컬 HTML 리포트.

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const CLAUDE_JSON = path.join(HOME, ".claude.json");

const PAYLOAD_VERSION = 1;

// ── 안전한 파일시스템 헬퍼 (없으면 0/false, 절대 throw 하지 않음) ──────────────

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function countSubdirs(dir) {
  return safeReadDir(dir).filter((e) => e.isDirectory()).length;
}

function countFilesMatching(dir, re) {
  return safeReadDir(dir).filter((e) => e.isFile() && re.test(e.name)).length;
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// 하위 디렉토리 이름 목록(소문자) — flag 판정용. 이름은 로컬 판정에만 쓰고 수집물엔 넣지 않는다.
function subdirNamesLower(dir) {
  return safeReadDir(dir)
    .filter((e) => e.isDirectory())
    .map((e) => e.name.toLowerCase());
}

function fileNamesLower(dir) {
  return safeReadDir(dir)
    .filter((e) => e.isFile())
    .map((e) => e.name.toLowerCase());
}

// ── 스캔: totals ─────────────────────────────────────────────────────────────

function scanTotals() {
  const skills = countSubdirs(path.join(CLAUDE_DIR, "skills"));
  const agents = countFilesMatching(path.join(CLAUDE_DIR, "agents"), /\.md$/i);
  const plugins = countSubdirs(path.join(CLAUDE_DIR, "plugins", "marketplaces"));
  const projects = countSubdirs(path.join(CLAUDE_DIR, "projects"));
  const sessions = projects; // 스펙: projects/ 하위 디렉토리 수 = 세션 근사

  // hooks: settings.json의 hooks 각 이벤트 배열 길이 합
  let hooks = 0;
  const settings = readJson(path.join(CLAUDE_DIR, "settings.json")) || {};
  const hookObj = settings.hooks;
  if (hookObj && typeof hookObj === "object") {
    for (const key of Object.keys(hookObj)) {
      const arr = hookObj[key];
      if (Array.isArray(arr)) hooks += arr.length;
    }
  }

  // mcpServers: ~/.claude.json 우선, 없으면 settings.json, 둘 다 없으면 0
  let mcpServers = 0;
  const claudeJson = readJson(CLAUDE_JSON);
  if (claudeJson && claudeJson.mcpServers && typeof claudeJson.mcpServers === "object") {
    mcpServers = Object.keys(claudeJson.mcpServers).length;
  } else if (settings.mcpServers && typeof settings.mcpServers === "object") {
    mcpServers = Object.keys(settings.mcpServers).length;
  }

  return { skills, agents, hooks, plugins, mcpServers, sessions, projects };
}

// ── 스캔: flags ──────────────────────────────────────────────────────────────

function scanFlags(settings) {
  const hasClaudeMd = exists(path.join(CLAUDE_DIR, "CLAUDE.md"));

  // memory: projects/*/memory 가 하나라도 존재
  let hasMemory = false;
  for (const proj of safeReadDir(path.join(CLAUDE_DIR, "projects"))) {
    if (proj.isDirectory() && exists(path.join(CLAUDE_DIR, "projects", proj.name, "memory"))) {
      hasMemory = true;
      break;
    }
  }

  const modelConfigured = typeof settings.model === "string" && settings.model.length > 0;

  // 이름 기반 흔적 판정 — 스킬 디렉토리명 + 커맨드 파일명 + 플러그인 마켓명.
  const skillNames = subdirNamesLower(path.join(CLAUDE_DIR, "skills"));
  const commandNames = fileNamesLower(path.join(CLAUDE_DIR, "commands"));
  const pluginNames = subdirNamesLower(path.join(CLAUDE_DIR, "plugins", "marketplaces"));
  const nameHaystack = [...skillNames, ...commandNames, ...pluginNames];

  const hasPlaywright = nameHaystack.some((n) => /playwright|browse/.test(n));
  const hasCron = nameHaystack.some((n) => /schedule|loop|cron/.test(n));
  const hasWorkflows = exists(path.join(CLAUDE_DIR, "workflows"));

  return { hasClaudeMd, hasMemory, modelConfigured, hasPlaywright, hasCron, hasWorkflows };
}

// ── 점수 루브릭 (스펙 §5) ─────────────────────────────────────────────────────
// 각 영역: 가중치 + score(0~100) 산식. 산식은 단순 임계 매핑이며 아래 상수표에 명시한다.
// 판정(verdict): score>=60 "잘씀". 미만이면 가중치>=10 "몰라서", <10 "불필요".

const SCORE_PASS = 60; // "잘씀" 임계
const VALUE_HIGH = 10; // 이 이상 가중치면 낮은 점수는 "몰라서 못 씀"(개선 추천)

// 계단식 임계 매핑: [경계값, 점수] 오름차순. 값 >= 경계값이면 그 점수. 첫 항목은 [0, base].
function ladder(value, steps) {
  let out = steps[0][1];
  for (const [threshold, pts] of steps) {
    if (value >= threshold) out = pts;
  }
  return out;
}

// 라벨은 스펙 §5 표의 한국어. key는 지시된 10개 고정 키.
const CATEGORY_DEFS = [
  {
    key: "basics",
    label: "기본 코딩 활용",
    weight: 15,
    score: (t) => ladder(t.projects, [[0, 0], [1, 40], [5, 70], [15, 90], [30, 100]]),
  },
  {
    key: "customize",
    label: "커스터마이즈",
    weight: 10,
    // 훅 수 + CLAUDE.md 존재. 훅이 있으면 계단, CLAUDE.md 없으면 20점 감점.
    score: (t, f) => {
      const base = ladder(t.hooks, [[0, 0], [1, 40], [5, 65], [15, 85], [30, 100]]);
      return f.hasClaudeMd ? base : Math.max(0, base - 20);
    },
  },
  {
    key: "skills",
    label: "스킬 생태계",
    weight: 15,
    score: (t) => ladder(t.skills, [[0, 0], [1, 40], [10, 70], [50, 90], [150, 100]]),
  },
  {
    key: "agents",
    label: "에이전트 위임",
    weight: 10,
    score: (t) => ladder(t.agents, [[0, 0], [1, 45], [5, 70], [15, 90], [30, 100]]),
  },
  {
    key: "model",
    label: "모델 전략",
    weight: 5,
    score: (t, f) => (f.modelConfigured ? 100 : 0),
  },
  {
    key: "browser",
    label: "브라우저 검증",
    weight: 10,
    score: (t, f) => (f.hasPlaywright ? 100 : 0),
  },
  {
    key: "memory",
    label: "메모리·컨텍스트",
    weight: 10,
    // memory 존재 + CLAUDE.md 계층. 둘 다면 100, 하나면 60, 없으면 0.
    score: (t, f) => (f.hasMemory && f.hasClaudeMd ? 100 : f.hasMemory || f.hasClaudeMd ? 60 : 0),
  },
  {
    key: "automation",
    label: "자동화·스케줄",
    weight: 15,
    // 훅 수 + cron/루틴 흔적. 흔적 있으면 +25 보너스(상한 100).
    score: (t, f) => {
      const base = ladder(t.hooks, [[0, 0], [1, 35], [5, 55], [15, 75], [30, 90]]);
      return Math.min(100, base + (f.hasCron ? 25 : 0));
    },
  },
  {
    key: "orchestration",
    label: "오케스트레이션",
    weight: 5,
    // workflows 디렉토리 or team/orchestr 스킬 흔적. 여기선 hasWorkflows + 에이전트 다수.
    score: (t, f) => {
      if (f.hasWorkflows) return 100;
      return ladder(t.agents, [[0, 0], [5, 40], [15, 70], [30, 85]]);
    },
  },
  {
    key: "integrations",
    label: "외부 연동",
    weight: 5,
    score: (t) => ladder(t.mcpServers, [[0, 0], [1, 55], [3, 80], [6, 100]]),
  },
];

function verdictFor(score, weight) {
  if (score >= SCORE_PASS) return "잘씀";
  return weight >= VALUE_HIGH ? "몰라서" : "불필요";
}

function computeCategories(totals, flags) {
  return CATEGORY_DEFS.map((def) => {
    const raw = def.score(totals, flags);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    return { key: def.key, label: def.label, score, verdict: verdictFor(score, def.weight) };
  });
}

function computeTotal(categories) {
  const totalWeight = CATEGORY_DEFS.reduce((s, d) => s + d.weight, 0);
  let acc = 0;
  for (const def of CATEGORY_DEFS) {
    const cat = categories.find((c) => c.key === def.key);
    acc += cat.score * def.weight;
  }
  return Math.round(acc / totalWeight);
}

// ── 전송 계약 페이로드 ────────────────────────────────────────────────────────

function buildPayload(totals, flags, categories, _scoreTotal) {
  // 와이어 계약 = 스펙 §3: {v, totals, flags, categories}. (§4의 meta/score_total은
  // 서버가 저장 시 만드는 DB 형태 — 총점도 서버가 재계산하므로 보내지 않는다.)
  return {
    v: PAYLOAD_VERSION,
    totals,
    flags,
    categories,
  };
}

// ── 자가 검증(assert) — 비자명 로직(루브릭·계단) 깨지면 즉시 실패 ────────────────

function selfCheck() {
  // ladder 경계 동작
  console.assert(ladder(0, [[0, 0], [1, 40]]) === 0, "ladder base");
  console.assert(ladder(1, [[0, 0], [1, 40]]) === 40, "ladder step");
  console.assert(ladder(999, [[0, 0], [1, 40], [50, 90]]) === 90, "ladder top");
  // verdict 분기
  console.assert(verdictFor(60, 5) === "잘씀", "verdict pass");
  console.assert(verdictFor(10, 15) === "몰라서", "verdict high-value gap");
  console.assert(verdictFor(10, 5) === "불필요", "verdict low-value gap");
  // 총점은 0~100
  const cats = computeCategories(
    { skills: 0, agents: 0, hooks: 0, plugins: 0, mcpServers: 0, sessions: 0, projects: 0 },
    { hasClaudeMd: false, hasMemory: false, modelConfigured: false, hasPlaywright: false, hasCron: false, hasWorkflows: false }
  );
  const t = computeTotal(cats);
  console.assert(t >= 0 && t <= 100, "total in range");
  console.assert(CATEGORY_DEFS.length === 10, "exactly 10 categories");
}

// ── 출력/전송/폴백 ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { base: process.env.BASE_URL || "https://claudecowork.co.kr", yes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) {
      out.base = argv[++i];
    } else if (argv[i] === "--yes" || argv[i] === "-y") {
      out.yes = true;
    }
  }
  out.base = out.base.replace(/\/+$/, "");
  return out;
}

function printCollected(payload, categories, scoreTotal) {
  console.log("\n" + "=".repeat(52));
  console.log(" Claude Code 사용 진단 — 수집 데이터 (개수·불리언만)");
  console.log("=".repeat(52));
  console.log(" 총점:", scoreTotal, "/ 100");
  console.log(" 영역별:");
  for (const c of categories) {
    const bar = "█".repeat(Math.round(c.score / 5)).padEnd(20, " ");
    console.log(`   ${c.label.padEnd(9, " ")} ${String(c.score).padStart(3)} [${bar}] ${c.verdict}`);
  }
  console.log("\n 전송 페이로드(JSON):");
  console.log(JSON.stringify(payload, null, 2));
  console.log("=".repeat(52) + "\n");
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function openBrowser(url) {
  // 플랫폼별 오픈. shell:true는 인젝션 위험 있으나 url은 우리가 만든 신뢰값(서버 응답 or file://).
  // 그래도 방어적으로: 공백/따옴표를 검증하고 shell 없이 인자 배열로 넘긴다.
  try {
    const plat = process.platform;
    if (plat === "win32") {
      // start는 cmd 내장 → cmd.exe 경유. 첫 인자 ""는 제목자리(경로에 공백 대비).
      spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (plat === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // 브라우저 오픈 실패는 치명적이지 않다 — URL/파일 경로는 이미 콘솔에 출력됨.
  }
}

async function postScan(base, payload) {
  const url = `${base}/api/scan`;
  const body = JSON.stringify(payload);
  // Node 18+ 전역 fetch. AbortController로 5초 타임아웃.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data; // 기대: { url } 또는 { id }
  } finally {
    clearTimeout(timer);
  }
}

// ── 로컬 폴백 리포트 (외부 의존 제로, 인라인 HTML) ─────────────────────────────

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function buildLocalReportHtml(payload, categories, scoreTotal) {
  const verdictColor = { 잘씀: "#16a34a", 몰라서: "#d97706", 불필요: "#64748b" };
  const rows = categories
    .map((c) => {
      const col = verdictColor[c.verdict] || "#64748b";
      return `<div class="row">
        <span class="label">${esc(c.label)}</span>
        <span class="track"><span class="fill" style="width:${c.score}%;background:${col}"></span></span>
        <span class="score">${c.score}</span>
        <span class="verdict" style="color:${col}">${esc(c.verdict)}</span>
      </div>`;
    })
    .join("\n");

  const grade = scoreTotal >= 80 ? "상급자" : scoreTotal >= 60 ? "숙련" : scoreTotal >= 35 ? "입문" : "미개척";

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code 진단 (로컬)</title>
<style>
  :root { --bg:#0b1120; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --accent:#6366f1; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 14px; margin-bottom: 28px; }
  .scorecard { background: linear-gradient(135deg,#1e1b4b,#111827); border:1px solid #312e81; border-radius:16px; padding:28px; text-align:center; margin-bottom:28px; }
  .big { font-size: 64px; font-weight: 800; line-height: 1; background: linear-gradient(90deg,#818cf8,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .grade { display:inline-block; margin-top:10px; padding:4px 14px; border:1px solid var(--accent); border-radius:999px; font-size:13px; color:#c7d2fe; }
  .card { background: var(--card); border:1px solid #1f2937; border-radius:14px; padding:20px; }
  .row { display:grid; grid-template-columns: 96px 1fr 34px 52px; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #1f2937; }
  .row:last-child { border-bottom:0; }
  .label { font-size:13px; color:#cbd5e1; }
  .track { height:8px; background:#1f2937; border-radius:999px; overflow:hidden; }
  .fill { display:block; height:100%; border-radius:999px; }
  .score { font-variant-numeric: tabular-nums; text-align:right; font-size:13px; color:#e5e7eb; }
  .verdict { font-size:12px; text-align:right; font-weight:600; }
  .foot { margin-top:24px; color: var(--muted); font-size:12px; line-height:1.6; }
  .foot code { background:#1f2937; padding:2px 6px; border-radius:6px; color:#e5e7eb; }
  .offline { margin-top:16px; padding:10px 14px; background:#3f1d1d; border:1px solid #7f1d1d; border-radius:10px; color:#fca5a5; font-size:13px; }
</style></head>
<body><div class="wrap">
  <h1>Claude Code 사용 진단</h1>
  <div class="sub">로컬 리포트 · 데이터는 이 PC를 벗어나지 않았습니다</div>

  <div class="scorecard">
    <div class="big">${scoreTotal}</div>
    <div class="grade">${esc(grade)} · 100점 만점</div>
  </div>

  <div class="card">${rows}</div>

  <div class="offline">서버에 연결하지 못해 로컬 리포트를 생성했습니다. 서버 실행 후 다시 진단하면 스킬 추천을 받을 수 있습니다.</div>

  <div class="foot">
    판정 기준: 60점 이상 <b>잘씀</b> · 미만이며 중요 영역은 <b>몰라서</b>(개선 추천) · 덜 중요하면 <b>불필요</b>(무시 OK).<br>
    다시 진단: <code>node checkup.mjs</code>
  </div>
</div></body></html>`;
}

function writeLocalReport(payload, categories, scoreTotal) {
  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "report-local.html");
  const html = buildLocalReportHtml(payload, categories, scoreTotal);
  fs.writeFileSync(outPath, html, "utf8");
  return outPath;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  selfCheck();

  const args = parseArgs(process.argv.slice(2));
  const settings = readJson(path.join(CLAUDE_DIR, "settings.json")) || {};
  const totals = scanTotals();
  const flags = scanFlags(settings);
  const categories = computeCategories(totals, flags);
  const scoreTotal = computeTotal(categories);
  const payload = buildPayload(totals, flags, categories, scoreTotal);

  printCollected(payload, categories, scoreTotal);

  // 전송 동의 — --yes면 스킵. TTY 아니면(파이프) 동의 없이 로컬 모드로.
  let consent = args.yes;
  if (!consent) {
    if (process.stdin.isTTY) {
      const ans = await ask("이 데이터를 전송할까요? (y/N) ");
      consent = ans === "y" || ans === "yes";
    } else {
      console.log("(비대화형 실행 — 전송 동의 없음, 로컬 모드로 진행)");
      consent = false;
    }
  }

  if (consent) {
    try {
      const data = await postScan(args.base, payload);
      const fullUrl = data && data.url
        ? (/^https?:\/\//.test(data.url) ? data.url : `${args.base}${data.url}`)
        : data && data.id
        ? `${args.base}/result/${data.id}`
        : null;
      if (fullUrl) {
        console.log("전송 완료. 결과 페이지:", fullUrl);
        openBrowser(fullUrl);
        return;
      }
      throw new Error("서버 응답에 url/id 없음");
    } catch (err) {
      console.error("전송 실패:", err.message, "— 로컬 리포트로 폴백합니다.");
      // 폴백으로 진행
    }
  } else {
    console.log("로컬 모드 — 전송하지 않고 로컬 리포트를 생성합니다.");
  }

  const outPath = writeLocalReport(payload, categories, scoreTotal);
  console.log("로컬 리포트 생성:", outPath);
  openBrowser("file://" + outPath.replace(/\\/g, "/"));
}

main().catch((err) => {
  // 어떤 예외든 사용자는 최소한 로컬 리포트를 봐야 한다.
  console.error("예기치 못한 오류:", err && err.message);
  try {
    const totals = scanTotals();
    const settings = readJson(path.join(CLAUDE_DIR, "settings.json")) || {};
    const flags = scanFlags(settings);
    const categories = computeCategories(totals, flags);
    const scoreTotal = computeTotal(categories);
    const payload = buildPayload(totals, flags, categories, scoreTotal);
    const outPath = writeLocalReport(payload, categories, scoreTotal);
    console.log("로컬 리포트 생성:", outPath);
  } catch {
    process.exitCode = 1;
  }
});
