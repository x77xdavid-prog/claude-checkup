// SKILL.md 파싱 + 카테고리 분류 — build-catalog.mjs와 ingest-external.mjs의 단일 진실 소스.
// 규칙을 두 곳에 두면 드리프트가 생기므로 여기 한 곳에서만 정의(로컬·외부 분류 일관 보장).
// 순수 로직만(네트워크 없음) → 어느 스크립트에서든 안전하게 import.

import { fileURLToPath } from "node:url";

export const DESC_MAX = 300;

// ── 카테고리 분류 규칙 ────────────────────────────────────────────────────────
// name+description 소문자 매칭. 순서대로 첫 매치 승 — 순서 절대 변경 금지(스펙 표).
// name<2자 / 한글 자모(ㅇㅇ)여도 제외하지 않고 매치 없으면 "기타".
export const CATEGORY_RULES = [
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
export const CATEGORY_FALLBACK = "기타";

// name+description 소문자 하나로 합쳐 첫 매치 규칙의 카테고리 반환.
export function classify(name, description) {
  const hay = `${name} ${description}`.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(hay)) return cat;
  }
  return CATEGORY_FALLBACK;
}

// ── frontmatter 파서 (파이썬 parse_front 이식) ───────────────────────────────
// 멀티라인 |/> 블록 처리 + [1:] 픽스(마커 라인 잔여 빈 문자열 건너뜀).
export function parseFront(text) {
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

// ── 자가 체크: 직접 실행 시에만(import 시엔 실행 안 됨) ─────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = (c, m) => { if (!c) throw new Error("FAIL " + m); };
  const plain = parseFront("---\nname: foo\ndescription: hello world\n---\nbody");
  a(plain.name === "foo" && plain.description === "hello world", "plain fm");
  const multi = parseFront("---\nname: bar\ndescription: |\n  line one\n  line two\nother: x\n---\n");
  a(multi.description === "line one line two", "multiline | fm: " + multi.description);
  const folded = parseFront("---\ndescription: >-\n  a\n  b\n---\n");
  a(folded.description === "a b", "folded >- fm");
  a(Object.keys(parseFront("no frontmatter")).length === 0, "no fm");
  a(classify("gsd-ship", "deploy to prod") === "프로젝트 관리", "gsd 우선");
  a(classify("vibesec", "security audit") === "보안", "보안");
  a(classify("ralph-loop", "orchestrate") === "자동화·스케줄", "loop가 오케보다 앞");
  a(classify("autopilot", "run agents") === "오케스트레이션·에이전트", "오케");
  a(classify("ㅇㅇ", "clipboard paste") === CATEGORY_FALLBACK, "자모→기타");
  a(classify("zzz", "") === CATEGORY_FALLBACK, "무매치→기타");
  console.log("skill-parse.mjs self-check OK");
}
