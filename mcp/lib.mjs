// checkup-skills-mcp — pure helpers + fetchers (NO MCP imports here).
// 로직은 cli/index.mjs의 순수 함수를 자립적으로 재구현한 것(동작 동일). cli/에서 import하지 않는다.
// (cli/index.mjs 하단에서 main(process.argv)를 호출하므로 import하면 CLI가 실행됨.)

// 동의어 그룹(ko↔en) — data/search-synonyms.json 단일 진실 소스. lib/search-expand.ts가 동일 데이터를
// import로 소비한다. 정적 import(+import attribute)라 webpack이 번들에 인라인 → 배포 HTTP 라우트에서도
// 확장이 동작하고, 순수 Node(stdio 서버·selfTest)에서도 그대로 로드된다.
import SYNONYMS_DATA from "../data/search-synonyms.json" with { type: "json" };

export const CATALOG_URL = "https://claudecowork.co.kr/catalog.json";
export const SITE_URL = "https://claudecowork.co.kr";
export const SOURCE_POLICY_URL = "https://claudecowork.co.kr/ko/source-policy";
export const WHATS_NEW_URL = "https://claudecowork.co.kr/whats-new.json";

const SYN_GROUPS = SYNONYMS_DATA && Array.isArray(SYNONYMS_DATA.groups) ? SYNONYMS_DATA.groups : [];

// ── 순수 함수 (fs/network 없음) ──────────────────────────────────────────────

// name/description/category 각각에 대해 대소문자 무시 부분일치 (필드 경계를 넘어 오검색 금지).
function fieldMatches(entry, q) {
  const name = String(entry?.name ?? "").toLowerCase();
  const desc = String(entry?.description ?? "").toLowerCase();
  const cat = String(entry?.category ?? "").toLowerCase();
  return name.includes(q) || desc.includes(q) || cat.includes(q);
}

export function filterCatalog(catalog, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [];
  return (Array.isArray(catalog) ? catalog : []).filter((entry) => fieldMatches(entry, q));
}

export function truncate(str, max) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

// install2.command가 있으면 줄 단위로 분리, 없으면 note, 둘 다 없으면 사이트 안내 문구.
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

// 이름 정확 일치(대소문자 무시). 없으면 null.
export function findExact(catalog, name) {
  const target = String(name ?? "").trim().toLowerCase();
  if (!target) return null;
  const list = Array.isArray(catalog) ? catalog : [];
  return list.find((e) => String(e?.name ?? "").toLowerCase() === target) ?? null;
}

// 설치 안전 게이트의 핵심 판별.
// verified = kind가 "marketplace"|"verified-repo" AND command가 비어있지 않은 문자열.
export function classifyInstall(entry) {
  const i2 = entry?.install2 ?? {};
  const kind = typeof i2.kind === "string" ? i2.kind : "unverified";
  const command = typeof i2.command === "string" && i2.command.trim() ? i2.command : null;
  const kindOk = kind === "marketplace" || kind === "verified-repo";
  const verified = kindOk && command !== null;
  let reason;
  if (verified) reason = `검증된 출처(${kind})의 설치 명령이 확인됨`;
  else if (!kindOk) reason = `미검증 출처 유형(${kind})`;
  else reason = `검증 유형(${kind})이나 설치 명령이 비어 있음`;
  return { verified, kind, command, reason };
}

// ── 동의어 확장 + 카테고리 폴백 (검색 폴백 체인 #14 / ko↔en 교차검색 #15) ──────────────
// lib/search-expand.ts의 memberHit/expandQuery와 동일 로직(자립 재구현 — cli/mcp 독립성).
export const LOW_RESULTS = 3; // "few or zero" 임계값 — 이 미만이면 동의어 확장 병합
export const MAX_ZERO_SAMPLES = 6; // 0건 폴백에서 보여줄 근접 카테고리 스킬 수(정직: 인기 아님)

function memberHit(m, q) {
  const ml = String(m).toLowerCase();
  if (ml === q) return true;
  const hasHangul = /[가-힣]/.test(ml);
  if (ml.length >= 3 || hasHangul) {
    if (q.length >= 2 && ml.includes(q)) return true;
    if (q.includes(ml)) return true;
  }
  return false;
}

// 질의어 → [원질의, ...동의어(소문자)]. 확장 없으면 [q]. 2자 미만은 확장 안 함.
export function expandQuery(query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return q ? [q] : [];
  const out = new Set([q]);
  for (const group of SYN_GROUPS) {
    if (Array.isArray(group) && group.some((m) => memberHit(m, q))) {
      for (const m of group) out.add(String(m).toLowerCase());
    }
  }
  return [...out];
}

// 동의어까지 확장해 매치 병합(dedupe by name, 원결과 우선). primary가 충분하면 그대로.
function expandedMatches(catalog, query) {
  const primary = filterCatalog(catalog, query);
  if (primary.length >= LOW_RESULTS) return primary;
  const base = String(query ?? "").trim().toLowerCase();
  const seen = new Set(primary.map((e) => String(e?.name ?? "")));
  const merged = [...primary];
  for (const term of expandQuery(query)) {
    if (term === base) continue; // 원질의는 primary에 이미 반영
    for (const e of filterCatalog(catalog, term)) {
      const nm = String(e?.name ?? "");
      if (!seen.has(nm)) {
        seen.add(nm);
        merged.push(e);
      }
    }
  }
  return merged;
}

// 카탈로그에 실재하는 카테고리 목록(중복 제거, 등장 순).
function categoriesInCatalog(catalog) {
  const set = new Set();
  for (const e of Array.isArray(catalog) ? catalog : []) {
    const c = e && e.category;
    if (typeof c === "string" && c) set.add(c);
  }
  return [...set];
}

// 질의(+동의어)와 가장 잘 맞는 카테고리들 — 이름 부분일치(양방향). ko↔en 교차.
function matchCategories(catalog, query) {
  const terms = expandQuery(query);
  const hits = [];
  for (const cat of categoriesInCatalog(catalog)) {
    const cl = cat.toLowerCase();
    if (terms.some((t) => t.length >= 2 && (cl.includes(t) || t.includes(cl)))) hits.push(cat);
  }
  return hits;
}

// 0건 폴백 — 막다른 "0건" 대신 근접 카테고리 안내 + 근접 스킬 샘플 + 정직한 기록 고지.
function renderZeroGuidance(catalog, query) {
  const lines = [`검색 결과 없음: "${query}" (0건).`];
  const cats = matchCategories(catalog, query);
  if (cats.length > 0) {
    lines.push("");
    lines.push(`관련 있어 보이는 카테고리: ${cats.slice(0, 5).join(" · ")}`);
    const top = cats[0];
    const sample = (Array.isArray(catalog) ? catalog : []).filter((e) => e && e.category === top).slice(0, MAX_ZERO_SAMPLES);
    if (sample.length > 0) {
      lines.push("");
      lines.push(`비슷한 목적의 스킬 (${top} 카테고리에서 · 인기순 아님):`);
      sample.forEach((e, i) => lines.push(`  ${i + 1}. ${e.name}`));
    }
  } else {
    const browse = categoriesInCatalog(catalog).slice(0, 8);
    if (browse.length > 0) {
      lines.push("");
      lines.push(`둘러볼 카테고리: ${browse.join(" · ")}`);
    }
  }
  lines.push("");
  lines.push(`이 검색어는 익명으로 기록되어 앞으로 카탈로그를 보강하는 데 쓰입니다. 다른 표현으로도 검색해 보세요. (${SITE_URL})`);
  return lines.join("\n");
}

// ── 렌더 (순수: catalog + 인자 → {text, isError}) — stdio·HTTP 두 전송이 공유 ──
export const DESC_MAX = 100;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const MAX_SAMPLE_PROMPTS = 5;

function badge(cls) {
  return cls.verified ? "검증됨" : "미검증";
}

// search_skills 본문. catalog + query(+limit) → 목록 텍스트.
// 폴백 체인: L1/L2 부분일치(filterCatalog) → 결과가 적으면 L3 동의어 확장 병합 →
// 그래도 0건이면 막다른 화면 대신 근접 카테고리 안내(renderZeroGuidance).
export function renderSearch(catalog, query, limit) {
  const matches = expandedMatches(catalog, query);
  if (matches.length === 0) {
    return { text: renderZeroGuidance(catalog, query), isError: false };
  }
  const n = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const shown = matches.slice(0, n);
  const lines = [];
  shown.forEach((e, i) => {
    const cls = classifyInstall(e);
    const cat = e.category ? ` [${e.category}]` : "";
    lines.push(`${i + 1}. ${e.name}${cat}`);
    lines.push(`   ${truncate(e.description, DESC_MAX)}`);
    lines.push(`   출처: ${e.source ?? "미상"} · 설치유형: ${cls.kind} · ${badge(cls)}`);
  });
  lines.push("");
  lines.push(`전체 ${matches.length}건 중 ${shown.length}건 표시. 상세는 skill_info, 설치는 install_skill 도구를 쓰세요. (${SITE_URL})`);
  return { text: lines.join("\n"), isError: false };
}

// skill_info 본문. prompts는 이미 받아온 예시(없으면 []).
export function renderSkillInfo(catalog, name, prompts = []) {
  const entry = findExact(catalog, name);
  if (!entry) {
    return { text: `일치하는 스킬이 없습니다: "${name}". search_skills 도구로 먼저 검색하세요.`, isError: true };
  }
  const cls = classifyInstall(entry);
  const lines = [`■ ${entry.name}${entry.category ? ` [${entry.category}]` : ""}`];
  if (entry.collection) lines.push(`컬렉션: ${entry.collection}`);
  lines.push(`출처: ${entry.source ?? "미상"}`);
  lines.push(`라이선스: ${entry.install2?.license || "미상"}`);
  lines.push(`설치유형: ${cls.kind} · ${badge(cls)}`);
  lines.push("");
  lines.push(entry.description ?? "");
  lines.push("");
  lines.push("설치 명령:");
  for (const l of installLines(entry)) lines.push(`  ${l}`);
  if (prompts.length > 0) {
    lines.push("");
    lines.push("예시 프롬프트:");
    prompts.slice(0, MAX_SAMPLE_PROMPTS).forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }
  return { text: lines.join("\n"), isError: false };
}

// install_skill 본문 — 검증 게이트. 미검증은 거부(정상 응답), 없는 이름은 isError.
export function renderInstall(catalog, name) {
  const entry = findExact(catalog, name);
  if (!entry) {
    return { text: `일치하는 스킬이 없습니다: "${name}". search_skills 도구로 먼저 검색하세요.`, isError: true };
  }
  const cls = classifyInstall(entry);
  if (!cls.verified) {
    const lines = [
      `설치 거부: "${entry.name}" 는 검증된 출처가 아닙니다 (설치유형: ${cls.kind}).`,
      `사유: ${cls.reason}`,
      `claude-checkup 출처 정책상, 미검증 출처는 원클릭 설치 명령을 제공하지 않습니다.`,
      `출처 정책: ${SOURCE_POLICY_URL}`,
      `출처(수동 검토용): ${entry.source ?? "미상"}`,
      `직접 확인 후 설치하려면 사이트에서 검토하세요: ${SITE_URL}`,
    ];
    return { text: lines.join("\n"), isError: false };
  }
  const lines = [`검증됨: ${cls.kind}`, "", "설치 명령:"];
  for (const l of installLines(entry)) lines.push(`  ${l}`);
  lines.push("");
  lines.push(`출처: ${entry.source ?? "미상"}`);
  lines.push(`라이선스: ${entry.install2?.license || "미상"}`);
  lines.push("");
  lines.push("안전 안내: marketplace 명령(`/plugin ...`)은 Claude Code에서 실행하는 슬래시 명령입니다. 내용을 검토한 뒤 직접 실행하세요. 이 도구는 어떤 셸/child_process도 대신 실행하지 않습니다.");
  return { text: lines.join("\n"), isError: false };
}

// whats_new 본문. data = {generatedAt, items:[{name,category,addedAt}]} 또는 null.
export function renderWhatsNew(data, limit) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return { text: `최근 추가된 스킬 정보를 불러올 수 없습니다. ${SITE_URL} 에서 확인하세요.`, isError: false };
  }
  const n = Math.min(limit ?? 20, 50);
  const shown = data.items.slice(0, n);
  const lines = [`최근 추가된 스킬 ${shown.length}종 (생성: ${data.generatedAt ?? "미상"}):`, ""];
  shown.forEach((it, i) => {
    const cat = it.category ? ` [${it.category}]` : "";
    const date = typeof it.addedAt === "string" ? it.addedAt.slice(0, 10) : "";
    lines.push(`${i + 1}. ${it.name}${cat}${date ? ` — ${date}` : ""}`);
  });
  lines.push("");
  lines.push(`상세는 skill_info, 설치는 install_skill 도구를 쓰세요. (${SITE_URL})`);
  return { text: lines.join("\n"), isError: false };
}

// ── MCP 프롬프트 프리미티브(맛보기 3종) — stdio·HTTP 두 전송이 공유 ─────────────
// 유료 전환 퍼널의 무료 입구: prompts/list·prompts/get으로 노출. 각 반환 텍스트 말미에 티저 1줄.
// (a) brand_identity는 전용 템플릿, (b)(c)는 data/prompts.json 원문을 재작성 없이 인자 자리만 치환.
// 반환 프롬프트 말미 티저 — 3종 공통. SITE_URL(상단 정의) 재사용.
// 다크런치: 프로드 api_keys 마이그레이션 실행 전까지 curl CTA를 내걸지 않는다(500 안내 방지).
// 마이그레이션 확인 후 이 줄을 실경로 CTA(curl -X POST ${SITE_URL}/api/keys ...)로 교체할 것.
const PROMPT_TEASER = `\n\n---\n🗂 맛보기 3종입니다. 무료 키(분당 120 + 전체 라이브러리)가 곧 열립니다 — ${SITE_URL}/api/keys`;

// brand_identity에서 값 없는 인자 자리 표기 — "먼저 사용자에게 물어보라"고 지시.
const ASK_FIRST = "[여기에 입력 — 먼저 사용자에게 물어볼 것]";

function nonEmpty(v) {
  return typeof v === "string" && v.trim() !== "";
}

// 리터럴 토큰 치환([ ] 대괄호 등 정규식 특수문자 안전). 원문 유지 여부는 호출부가 판단.
function fillToken(template, token, value) {
  return template.split(token).join(value);
}

// (a) 브랜드 아이덴티티 — 전용 템플릿. 빈 인자 자리는 ASK_FIRST.
function renderBrandIdentity(args = {}) {
  const v = (k) => (nonEmpty(args[k]) ? args[k].trim() : ASK_FIRST);
  return [
    "당신은 숙련된 브랜드 전략가이자 디자이너입니다. 아래 비즈니스 정보로 브랜드 아이덴티티 시스템을 설계하세요.",
    "",
    "## 기준",
    "1. 로고는 니치·타깃과 관련 있고 기억에 남을 것 2. 컬러는 의도한 감정 반응·브랜드 성격과 일치 3. 폰트는 가독성+페어링 근거 4. 가이드라인은 전 접점 일관성 보장 5. 뻔한 요소(보라 그라데이션·3열 아이콘 그리드) 금지 6. hex·폰트명은 실존하는 것만, 근거와 함께.",
    "",
    "## 비즈니스 정보",
    `- 니치: ${v("niche")} / 타깃: ${v("target_market")} / 성격: ${v("brand_personality")} / 차별점: ${v("key_differentiators")}`,
    "",
    "## 응답 형식",
    "**비즈니스 개요**(니치/타깃/성격/차별점) · **로고**(콘셉트/설명/포맷/컬러모드) · **컬러**(주/보조/강조/심리 근거) · **타이포**(주 폰트·보조 폰트 각 이름/스타일/용도 + 페어링 근거) · **가이드라인**(로고 규칙/색 적용/타이포 위계/이미지 스타일/보이스)",
  ].join("\n");
}

// (b) explain_code — data/prompts.json "dev-explain-code" body.ko 원문 그대로. code 인자만 자리 치환.
function renderExplainCode(args = {}) {
  const template = [
    "아래 코드를 초보도 이해할 수 있게 설명해줘.",
    "[코드 붙여넣기]",
    "",
    "요청:",
    "1) 한 줄 요약(이 코드가 하는 일)",
    "2) 흐름을 단계별로 쉬운 말로",
    "3) 위험하거나 헷갈릴 수 있는 부분",
    "4) 개선 아이디어가 있으면 1~2개",
  ].join("\n");
  return nonEmpty(args.code) ? fillToken(template, "[코드 붙여넣기]", args.code.trim()) : template;
}

// (c) translate_natural — data/prompts.json "translate-natural" body.ko 원문 그대로. 목표언어·원문만 치환.
function renderTranslateNatural(args = {}) {
  let template = [
    "아래 글을 [목표 언어]로 번역해줘.",
    "[원문 붙여넣기]",
    "",
    "조건:",
    "- 직역이 아니라 그 언어 원어민이 쓰듯 자연스럽게",
    "- 용도: [예: 이메일/제품 소개/자막]",
    "- 말투: [정중한/캐주얼]",
    "- 고유명사·전문용어는 원어 병기",
    "- 애매한 부분은 2가지 안으로",
  ].join("\n");
  if (nonEmpty(args.target_language)) template = fillToken(template, "[목표 언어]", args.target_language.trim());
  if (nonEmpty(args.text)) template = fillToken(template, "[원문 붙여넣기]", args.text.trim());
  return template;
}

// 등록/목록용 메타 + 렌더러. arguments는 MCP prompts 스키마와 동형(전부 optional string).
// 티저는 renderMcpPrompt가 붙이므로, 반환 텍스트는 항상 renderMcpPrompt를 거쳐 얻는다(render 직접호출 금지).
export const MCP_PROMPTS = [
  {
    name: "brand_identity",
    title: "브랜드 아이덴티티 설계",
    description: "니치·타깃·성격·차별점으로 로고/컬러/타이포/가이드라인을 갖춘 브랜드 아이덴티티 시스템을 설계한다.",
    arguments: [
      { name: "niche", description: "사업 니치·분야 (예: 수제 도자기)", required: false },
      { name: "target_market", description: "목표 고객·시장", required: false },
      { name: "brand_personality", description: "브랜드 성격·톤", required: false },
      { name: "key_differentiators", description: "핵심 차별점", required: false },
    ],
    render: renderBrandIdentity,
  },
  {
    name: "explain_code",
    title: "이 코드 뭐 하는지 설명",
    description: "낯선 코드를 초보도 이해하게 한 줄 요약·단계 설명·위험 지점·개선안으로 풀어준다.",
    arguments: [{ name: "code", description: "설명할 코드 (생략 시 붙여넣기 안내 유지)", required: false }],
    render: renderExplainCode,
  },
  {
    name: "translate_natural",
    title: "자연스러운 번역",
    description: "직역이 아니라 원어민이 쓰듯 자연스럽게 번역한다(용도·말투·고유명사 병기 포함).",
    arguments: [
      { name: "target_language", description: "번역할 목표 언어 (예: 영어)", required: false },
      { name: "text", description: "번역할 원문 (생략 시 붙여넣기 안내 유지)", required: false },
    ],
    render: renderTranslateNatural,
  },
];

// name → 완성 프롬프트 텍스트(+티저). 미등록 이름은 throw(등록된 이름만 호출되지만 방어).
export function renderMcpPrompt(name, args = {}) {
  const p = MCP_PROMPTS.find((x) => x.name === name);
  if (!p) throw new Error(`알 수 없는 프롬프트: ${name}`);
  return p.render(args ?? {}) + PROMPT_TEASER;
}

// ── 네트워크 (best-effort) ────────────────────────────────────────────────────

// cli/index.mjs의 fetchCatalog와 동일한 오류 처리(네트워크/HTTP/JSON/배열).
export async function fetchCatalog() {
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

// 예시 프롬프트 API. 404/네트워크/형식 오류는 모두 [] 로 흡수(best-effort).
export async function fetchSamplePrompts(name) {
  const target = String(name ?? "").trim();
  if (!target) return [];
  try {
    const url = `${SITE_URL}/api/sample-prompts/${encodeURIComponent(target)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.prompts)) return [];
    return data.prompts.filter((p) => typeof p === "string");
  } catch {
    return [];
  }
}

// 최근 추가 스킬. 실패/형식오류는 null(best-effort).
export async function fetchWhatsNew() {
  try {
    const res = await fetch(WHATS_NEW_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

// ── 자가 테스트: 순수 함수를 합성 데이터로 검증 (fs/network 없음) ──────────────

export function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error("FAIL self-test: " + msg);
  };

  const catalog = [
    {
      name: "glass-dark-ui",
      description: "Build dark-mode glassmorphism interfaces",
      category: "프론트엔드·디자인",
      source: "external:MengTo/Skills",
      install2: { kind: "verified-repo", command: "/plugin marketplace add x\n/plugin install glass@x", license: "MIT" },
    },
    {
      name: "commit",
      description: "Create a git commit",
      category: "배포·운영",
      source: "plugin:x",
      install2: { kind: "marketplace", command: "/plugin marketplace add x\n/plugin install commit@x" },
    },
    {
      name: "8-bit-orbit",
      description: "Retro pixel video template",
      category: "오케스트레이션·에이전트",
      source: "local",
      install2: { kind: "unverified", command: null, note: "출처 미확인" },
    },
    {
      // name 끝 "abc" + description 시작 "def" — 필드를 이어붙였다면 "abc def"가 거짓 매치될 경계 케이스.
      name: "widget-abc",
      description: "def-panel renderer",
      category: "기타",
      source: "local",
      install2: { kind: "unverified", command: null },
    },
  ];

  // filterCatalog: 필드별 부분일치.
  assert(filterCatalog(catalog, "glass").length === 1, "name 부분일치");
  assert(filterCatalog(catalog, "git commit").length === 1, "description 부분일치");
  assert(filterCatalog(catalog, "배포").length === 1, "category 부분일치");
  assert(filterCatalog(catalog, "GLASS").length === 1, "대소문자 무시");
  assert(filterCatalog(catalog, "없음xyz").length === 0, "매치 없으면 []");
  assert(filterCatalog(catalog, "").length === 0, "빈 검색어는 []");
  assert(filterCatalog(catalog, "abc def").length === 0, "필드 경계 넘어 거짓매치 금지");

  // truncate.
  assert(truncate("짧다", 80) === "짧다", "짧으면 그대로");
  assert(truncate("a".repeat(100), 80).endsWith("…"), "길면 말줄임");
  assert(truncate("a".repeat(100), 80).length === 81, "길이 80+…=81");

  // installLines.
  assert(installLines(catalog[1]).length === 2, "개행 명령은 여러 줄");
  assert(installLines(catalog[1])[1].includes("commit@x"), "둘째 줄 보존");
  assert(installLines(catalog[2])[0] === "출처 미확인", "command 없으면 note");
  assert(installLines(catalog[3])[0].includes(SITE_URL), "note도 없으면 사이트 안내");

  // findExact.
  assert(findExact(catalog, "commit")?.name === "commit", "정확 일치");
  assert(findExact(catalog, "COMMIT")?.name === "commit", "대소문자 무시");
  assert(findExact(catalog, "commi") === null, "부분일치는 실패");
  assert(findExact(catalog, "없음") === null, "없는 이름은 null");

  // classifyInstall — 설치 게이트 핵심.
  assert(classifyInstall(catalog[0]).verified === true, "verified-repo+command → verified");
  assert(classifyInstall(catalog[1]).verified === true, "marketplace+command → verified");
  assert(classifyInstall(catalog[2]).verified === false, "unverified → 거부");
  assert(classifyInstall(catalog[2]).kind === "unverified", "kind 보존");
  assert(classifyInstall({ install2: { kind: "verified-repo", command: "" } }).verified === false, "빈 command → 거부");
  assert(classifyInstall({ install2: { kind: "verified-repo", command: "   " } }).verified === false, "공백 command → 거부");
  assert(classifyInstall({}).verified === false, "install2 없으면 거부");
  assert(classifyInstall(catalog[0]).command.includes("glass@x"), "command 반환");

  // render 함수 (stdio·HTTP 공유 본문).
  assert(renderSearch(catalog, "glass", 10).text.includes("glass-dark-ui"), "renderSearch 매치");
  assert(renderSearch(catalog, "glass", 10).isError === false, "renderSearch 정상");
  assert(renderSearch(catalog, "없음xyz", 10).text.includes("검색 결과 없음"), "renderSearch 0건");

  // ── 동의어 확장(ko↔en 교차검색 #15) + 0건 폴백(#14) ──────────────────────────
  // expandQuery 순수 동작.
  assert(expandQuery("보안").includes("security"), "expandQuery: 보안→security");
  assert(expandQuery("security").includes("보안"), "expandQuery: security→보안(역방향)");
  assert(!expandQuery("build").includes("ui"), "expandQuery: 짧은 영문 오검색 차단(build⊅ui)");
  assert(expandQuery("a").length <= 1, "expandQuery: 1자 질의는 확장 안 함");

  // 동의어 확장으로 '보안'(한글) 질의가 영문 'security' 스킬을 찾는다(확장 전엔 0건이던 신규 동작).
  const synCatalog = [
    { name: "sec-scan", description: "Security scanner for your codebase", category: "기타", source: "local", install2: { kind: "unverified", command: null } },
    { name: "front-kit", description: "Frontend component kit", category: "기타", source: "local", install2: { kind: "unverified", command: null } },
  ];
  assert(filterCatalog(synCatalog, "보안").length === 0, "확장 전 '보안'은 직접 매치 0건");
  assert(renderSearch(synCatalog, "보안", 10).text.includes("sec-scan"), "동의어 확장으로 '보안'→security 스킬 매치(신규 동작)");

  // 완전 무매치 질의도 막다른 '0건'이 아니라 비어있지 않은 안내(기록 고지/카테고리)를 돌려준다.
  const zero = renderSearch(synCatalog, "존재하지않는질의zzz", 10);
  assert(zero.isError === false, "zero-hit는 isError=false");
  assert(zero.text.length > 20 && /기록|보강|카테고리/.test(zero.text), "zero-hit는 비어있지 않은 안내 텍스트(막다른 0건 금지)");
  assert(renderSkillInfo(catalog, "commit", ["예시1"]).text.includes("예시1"), "renderSkillInfo 프롬프트 포함");
  assert(renderSkillInfo(catalog, "commit", []).isError === false, "renderSkillInfo 정상");
  assert(renderSkillInfo(catalog, "없는거", []).isError === true, "renderSkillInfo 없음→isError");
  assert(renderInstall(catalog, "commit").text.includes("설치 명령:"), "renderInstall 검증→명령");
  assert(renderInstall(catalog, "8-bit-orbit").text.includes("설치 거부"), "renderInstall 미검증→거부");
  assert(renderInstall(catalog, "없는거").isError === true, "renderInstall 없음→isError");

  const wn = { generatedAt: "2026-07-09", items: [{ name: "vibesec", category: "보안", addedAt: "2026-07-09T13:33:56+09:00" }] };
  assert(renderWhatsNew(wn, 20).text.includes("vibesec"), "renderWhatsNew 항목");
  assert(renderWhatsNew(wn, 20).text.includes("2026-07-09"), "renderWhatsNew 날짜");
  assert(renderWhatsNew({ items: [] }, 20).isError === false, "renderWhatsNew 빈 목록 안전");
  assert(renderWhatsNew(null, 20).isError === false, "renderWhatsNew null 안전");

  // ── MCP 프롬프트 프리미티브(맛보기 3종) ──────────────────────────────────────
  assert(MCP_PROMPTS.length === 3, "프롬프트 3종");
  assert(MCP_PROMPTS.every((p) => typeof p.name === "string" && typeof p.render === "function"), "프롬프트 메타 형태");
  for (const p of MCP_PROMPTS) {
    assert(renderMcpPrompt(p.name, {}).includes(`${SITE_URL}/api/keys`), `${p.name}: 티저(무료 키 발급 경로) 포함`);
  }
  // (a) brand_identity: 인자 주입 + 빈 인자는 ASK_FIRST.
  const bi = renderMcpPrompt("brand_identity", { niche: "수제 도자기" });
  assert(bi.includes("수제 도자기"), "brand_identity: niche 주입");
  assert(bi.includes(ASK_FIRST), "brand_identity: 빈 인자는 물어보기 안내");
  assert(bi.includes("브랜드 아이덴티티 시스템을 설계"), "brand_identity: 본문 유지");
  // (b) explain_code: 빈 인자면 원문 placeholder 유지, code 있으면 치환.
  assert(renderMcpPrompt("explain_code", {}).includes("[코드 붙여넣기]"), "explain_code: 빈 인자는 원문 유지");
  const ec = renderMcpPrompt("explain_code", { code: "const x = 1;" });
  assert(ec.includes("const x = 1;") && !ec.includes("[코드 붙여넣기]"), "explain_code: code 치환");
  // (c) translate_natural: 미주입 자리는 원문 유지, 목표언어만 치환.
  const tr = renderMcpPrompt("translate_natural", { target_language: "영어" });
  assert(tr.includes("영어로 번역") && tr.includes("[원문 붙여넣기]"), "translate_natural: 목표언어만 치환");
  // 미등록 이름 방어.
  let threw = false;
  try {
    renderMcpPrompt("없는프롬프트");
  } catch {
    threw = true;
  }
  assert(threw, "renderMcpPrompt 미등록 이름은 throw");

  console.log("checkup-skills-mcp lib self-test OK");
}

// `node lib.mjs --self-test` 로 실행.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("lib.mjs")) {
  if (process.argv.includes("--self-test")) {
    try {
      selfTest();
      process.exitCode = 0;
    } catch (err) {
      console.error(err?.message ?? String(err));
      process.exitCode = 1;
    }
  }
}
