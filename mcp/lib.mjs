// checkup-skills-mcp — pure helpers + fetchers (NO MCP imports here).
// 로직은 cli/index.mjs의 순수 함수를 자립적으로 재구현한 것(동작 동일). cli/에서 import하지 않는다.
// (cli/index.mjs 하단에서 main(process.argv)를 호출하므로 import하면 CLI가 실행됨.)

export const CATALOG_URL = "https://claudecowork.co.kr/catalog.json";
export const SITE_URL = "https://claudecowork.co.kr";
export const SOURCE_POLICY_URL = "https://claudecowork.co.kr/ko/source-policy";
export const WHATS_NEW_URL = "https://claudecowork.co.kr/whats-new.json";

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

// ── 렌더 (순수: catalog + 인자 → {text, isError}) — stdio·HTTP 두 전송이 공유 ──
export const DESC_MAX = 100;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const MAX_SAMPLE_PROMPTS = 5;

function badge(cls) {
  return cls.verified ? "검증됨" : "미검증";
}

// search_skills 본문. catalog + query(+limit) → 목록 텍스트.
export function renderSearch(catalog, query, limit) {
  const matches = filterCatalog(catalog, query);
  if (matches.length === 0) {
    return { text: `검색 결과 없음: "${query}" (0건). 다른 검색어를 시도하거나 ${SITE_URL} 에서 둘러보세요.`, isError: false };
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
