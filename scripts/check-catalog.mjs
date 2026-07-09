// 카탈로그 정합성 게이트 — public/catalog.json의 모든 스킬이 public/sample-prompts/*.json을
// 올바른 형식으로 갖고 있는지 빌드 시점에 강제한다(agency-agents check-divisions.sh 이식:
// 규칙을 문서가 아니라 빌드가 지키게 한다). 외부 의존 없음(Node 내장 fs/path/url만).
// 실행: node scripts/check-catalog.mjs              — 실 데이터 검사
//       node scripts/check-catalog.mjs --self-test  — 검사 로직 자체를 합성 데이터로 검증

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG_PATH = path.join(ROOT, "public", "catalog.json");
const PROMPTS_DIR = path.join(ROOT, "public", "sample-prompts");
const LOCALES_DIR = path.join(ROOT, "locales");
const OWN_MARKETPLACE_PATH = path.join(ROOT, "data", "own-marketplace.json");
const VALID_KINDS = new Set(["marketplace", "verified-repo", "unverified"]);
const MAX_PRINTED = 40;

// 스킬명 → 파일명 (app/api/sample-prompts/[name]/route.ts의 toFilename과 대칭).
function toFilename(name) {
  return name.replace(/[:/]/g, "__") + ".json";
}

// ── 순수 검사 함수들 (fs 접근 없음 — self-test가 이 함수들만 합성 데이터로 검증) ──

// catalog 자체 정합성: name 중복, 경로위험문자(.. \ NUL).
function checkCatalogSelf(catalog) {
  const problems = [];
  const counts = new Map();
  for (const e of catalog) {
    const name = e && e.name;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  for (const [name, count] of counts) {
    if (count > 1) problems.push(`${name} :: catalog에 중복 name (${count}회)`);
  }
  for (const e of catalog) {
    const name = e && e.name;
    if (typeof name !== "string" || !name) {
      problems.push(`(unnamed) :: name이 비어있거나 문자열이 아님`);
      continue;
    }
    if (name.includes("..") || name.includes("\\") || name.includes("\0")) {
      problems.push(`${name} :: name에 경로위험문자 포함(.. \\ NUL)`);
    }
  }
  return problems;
}

// install2: 객체 + kind가 3종 중 하나. command는 null 허용(정직 원칙 — 검사 안 함).
function checkInstall2(catalog) {
  const problems = [];
  for (const e of catalog) {
    const name = (e && e.name) || "(unnamed)";
    const i2 = e && e.install2;
    if (typeof i2 !== "object" || i2 === null || Array.isArray(i2)) {
      problems.push(`${name} :: install2가 객체가 아님`);
      continue;
    }
    if (!VALID_KINDS.has(i2.kind)) {
      problems.push(`${name} :: install2.kind가 유효하지 않음 ("${i2.kind}")`);
    }
  }
  return problems;
}

// 자체 마켓 스킬은 설치 명령 필수(설치법 누락 방지): own-marketplace.json에 등재된 스킬이
// catalog에 존재하면 반드시 source==="plugin:<market>" + install2.kind==="marketplace" +
// install2.command에 "@<market>" 포함이어야 한다. 로컬 스캔이 local/unverified로 되돌리면 FAIL.
// catalog에 없는 이름은 스킵(부재로 실패시키지 않음). ownMk 없으면 빈 배열(호출부에서 스킵).
function checkOwnMarketplace(catalog, ownMk) {
  const problems = [];
  if (!ownMk || !Array.isArray(ownMk.skills) || !ownMk.marketplace) return problems;
  const expectedSource = `plugin:${ownMk.marketplace}`;
  const byName = new Map();
  for (const e of catalog) if (e && typeof e.name === "string") byName.set(e.name, e);
  for (const name of ownMk.skills) {
    const e = byName.get(name);
    if (!e) continue; // catalog에 없는 이름은 스킵
    const i2 = e.install2;
    const okSource = e.source === expectedSource;
    const okKind = i2 != null && i2.kind === "marketplace";
    const okCmd = i2 != null && typeof i2.command === "string" && i2.command.includes("@" + ownMk.marketplace);
    if (!okSource || !okKind || !okCmd) {
      problems.push(
        `${name} :: ${ownMk.marketplace} 마켓 스킬인데 marketplace 설치가 아님(local로 되돌아감?) — build-catalog 재실행 또는 data/own-marketplace.json 확인`,
      );
    }
  }
  return problems;
}

// 커버리지 + 고아: catalog 스킬명 목록 vs 실제 sample-prompts 파일명 목록.
function checkCoverage(catalogNames, promptFileNames) {
  const problems = [];
  const expected = new Map(); // 파일명 -> 스킬명
  for (const name of catalogNames) {
    if (typeof name !== "string" || !name) continue; // checkCatalogSelf가 이미 보고
    expected.set(toFilename(name), name);
  }
  const actual = new Set(promptFileNames);
  for (const [file, name] of expected) {
    if (!actual.has(file)) problems.push(`${name} :: sample-prompts 파일 없음 (${file})`);
  }
  for (const file of actual) {
    if (!expected.has(file)) problems.push(`${file} :: catalog에 없는 고아 파일`);
  }
  return problems;
}

// 개별 sample-prompts 파일: JSON 유효성 + name 일치 + prompts 정확히 10개 +
// 전부 string·trim 길이>=3 + trim 기준 중복 없음 + 한글 포함.
function checkPromptFile(fileLabel, rawText, expectedName) {
  const problems = [];
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    problems.push(`${fileLabel} :: JSON 파싱 실패 (${err.message})`);
    return problems;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    problems.push(`${fileLabel} :: 최상위가 객체가 아님`);
    return problems;
  }
  if (data.name !== expectedName) {
    problems.push(`${fileLabel} :: name 불일치 (파일:"${data.name}" != 카탈로그:"${expectedName}")`);
  }
  if (!Array.isArray(data.prompts)) {
    problems.push(`${fileLabel} :: prompts가 배열이 아님`);
    return problems;
  }
  if (data.prompts.length !== 10) {
    problems.push(`${fileLabel} :: prompts 길이 ${data.prompts.length} (정확히 10개 필요)`);
  }
  const seen = new Set();
  data.prompts.forEach((p, i) => {
    if (typeof p !== "string") {
      problems.push(`${fileLabel} :: prompts[${i}]가 문자열이 아님`);
      return;
    }
    const trimmed = p.trim();
    if (trimmed.length < 3) {
      problems.push(`${fileLabel} :: prompts[${i}] 너무 짧음 (trim 길이 ${trimmed.length})`);
    }
    if (!/[가-힣]/.test(p)) {
      problems.push(`${fileLabel} :: prompts[${i}]에 한글 없음`);
    }
    if (seen.has(trimmed)) {
      problems.push(`${fileLabel} :: prompts[${i}] 중복(trim 기준)`);
    }
    seen.add(trimmed);
  });
  return problems;
}

// 로케일 메타 스킬 개수 하드코딩 금지: catalogTitle/catalogDesc는 {count} 플레이스홀더를 써야 하고,
// 3자리 이상 숫자런이 있으면 누군가 개수를 다시 하드코딩한 것으로 보고 FAIL(569→979 드리프트 재발 방지).
// locales = [{ locale, meta }, ...] — fs 접근 없이 순수 검증(self-test 대상).
function checkNoHardcodedCounts(locales) {
  const problems = [];
  for (const { locale, meta } of locales) {
    for (const field of ["catalogTitle", "catalogDesc"]) {
      const val = meta && typeof meta[field] === "string" ? meta[field] : "";
      if (!val.includes("{count}") || /\d{3,}/.test(val)) {
        problems.push(`${locale}.json meta.${field}: 스킬 개수를 하드코딩하지 말 것 — {count} 플레이스홀더를 쓰세요 (드리프트 방지)`);
      }
    }
  }
  return problems;
}

// ── 실 데이터 실행 ────────────────────────────────────────────────────────────

function run() {
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  } catch (err) {
    console.error(`FAIL: catalog.json을 읽을 수 없음 (${err.message})`);
    process.exit(1);
  }
  if (!Array.isArray(catalog)) {
    console.error("FAIL: catalog.json 최상위가 배열이 아님");
    process.exit(1);
  }

  let promptFiles;
  try {
    promptFiles = fs.readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error(`FAIL: sample-prompts 디렉터리를 읽을 수 없음 (${err.message})`);
    process.exit(1);
  }

  const problems = [];
  problems.push(...checkCatalogSelf(catalog));
  problems.push(...checkInstall2(catalog));

  // 자체 마켓 스킬 게이트 — data/own-marketplace.json(없으면 이 검사만 스킵, 크래시 금지).
  let ownMk = null;
  try {
    ownMk = JSON.parse(fs.readFileSync(OWN_MARKETPLACE_PATH, "utf8"));
  } catch {
    ownMk = null; // 파일 없음/손상 → 스킵
  }
  problems.push(...checkOwnMarketplace(catalog, ownMk));

  const catalogNames = catalog.map((e) => e && e.name).filter((n) => typeof n === "string" && n);
  problems.push(...checkCoverage(catalogNames, promptFiles));

  const nameByFile = new Map();
  for (const name of catalogNames) nameByFile.set(toFilename(name), name);

  for (const file of promptFiles) {
    const expectedName = nameByFile.get(file);
    if (expectedName === undefined) continue; // 고아 파일은 checkCoverage가 이미 보고
    const raw = fs.readFileSync(path.join(PROMPTS_DIR, file), "utf8");
    problems.push(...checkPromptFile(file, raw, expectedName));
  }

  // 로케일 메타 하드코딩 검사 — locales/*.json의 catalogTitle/catalogDesc.
  let locales;
  try {
    locales = fs
      .readdirSync(LOCALES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        locale: f.replace(/\.json$/, ""),
        meta: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), "utf8")).meta,
      }));
  } catch (err) {
    console.error(`FAIL: locales를 읽을 수 없음 (${err.message})`);
    process.exit(1);
  }
  problems.push(...checkNoHardcodedCounts(locales));

  report(problems, catalog.length, promptFiles.length);
}

function report(problems, skillCount, fileCount) {
  if (problems.length === 0) {
    console.log(`OK: ${skillCount} skills, ${fileCount} prompt files, 0 problems`);
    process.exit(0);
  }
  for (const p of problems.slice(0, MAX_PRINTED)) console.error(p);
  if (problems.length > MAX_PRINTED) {
    console.error(`... 외 ${problems.length - MAX_PRINTED}건 생략`);
  }
  console.error(`FAIL: 문제 ${problems.length}건 (스킬 ${skillCount}, 프롬프트 파일 ${fileCount})`);
  process.exit(1);
}

// ── 자가 테스트: 검사 함수들을 합성 데이터로 검증(fs 없이) ─────────────────────

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error("FAIL self-test: " + msg);
  };
  const mkPrompts = (n, name) =>
    JSON.stringify({
      name,
      prompts: Array.from({ length: n }, (_, i) => `${name} 관련 테스트 프롬프트 ${i + 1}번째 요청`),
    });

  // 정상 케이스 — 전부 문제 0건이어야 함.
  const goodCatalog = [
    { name: "foo", install2: { kind: "unverified", command: null } },
    { name: "bar", install2: { kind: "verified-repo", command: "npx x" } },
  ];
  assert(checkCatalogSelf(goodCatalog).length === 0, "정상 catalog는 통과해야 함");
  assert(checkInstall2(goodCatalog).length === 0, "정상 install2는 통과해야 함(command:null 포함)");
  assert(checkCoverage(["foo", "bar"], ["foo.json", "bar.json"]).length === 0, "정상 커버리지는 통과해야 함");
  assert(checkPromptFile("foo.json", mkPrompts(10, "foo"), "foo").length === 0, "정상 파일은 통과해야 함");

  // 1) prompts 정확히 10개 아님 (적음/많음 둘 다).
  assert(
    checkPromptFile("foo.json", mkPrompts(9, "foo"), "foo").some((p) => p.includes("정확히 10개")),
    "9개는 잡아야 함",
  );
  assert(
    checkPromptFile("foo.json", mkPrompts(11, "foo"), "foo").some((p) => p.includes("정확히 10개")),
    "11개는 잡아야 함",
  );

  // 2) 중복 prompt (trim 기준).
  const dup = JSON.stringify({
    name: "foo",
    prompts: ["같은 문장입니다  ", "같은 문장입니다", ...Array.from({ length: 8 }, (_, i) => `서로 다른 문장 ${i}`)],
  });
  assert(checkPromptFile("foo.json", dup, "foo").some((p) => p.includes("중복")), "trim 기준 중복을 잡아야 함");

  // 3) 한글 없는 prompt.
  const noKorean = JSON.stringify({
    name: "foo",
    prompts: ["english only prompt here", ...Array.from({ length: 9 }, (_, i) => `한글 프롬프트 ${i}`)],
  });
  assert(checkPromptFile("foo.json", noKorean, "foo").some((p) => p.includes("한글 없음")), "한글 없음을 잡아야 함");

  // 3b) 너무 짧은 prompt (trim 길이 < 3).
  const tooShort = JSON.stringify({
    name: "foo",
    prompts: ["가나", ...Array.from({ length: 9 }, (_, i) => `정상 프롬프트 ${i}`)],
  });
  assert(checkPromptFile("foo.json", tooShort, "foo").some((p) => p.includes("너무 짧음")), "너무 짧은 프롬프트를 잡아야 함");

  // 4) name 불일치.
  const nameMismatch = JSON.stringify({ name: "wrong", prompts: Array.from({ length: 10 }, (_, i) => `정상 프롬프트 ${i}`) });
  assert(checkPromptFile("foo.json", nameMismatch, "foo").some((p) => p.includes("name 불일치")), "name 불일치를 잡아야 함");

  // 4b) 손상된 JSON.
  assert(checkPromptFile("foo.json", "{ not json", "foo").some((p) => p.includes("JSON 파싱 실패")), "깨진 JSON을 잡아야 함");

  // 5) 커버리지: 누락 + 고아.
  const missing = checkCoverage(["foo", "missing-one"], ["foo.json"]);
  assert(missing.some((p) => p.includes("파일 없음")), "누락 파일을 잡아야 함");
  const orphan = checkCoverage(["foo"], ["foo.json", "orphan.json"]);
  assert(orphan.some((p) => p.includes("고아")), "고아 파일을 잡아야 함");

  // 6) install2 이상.
  assert(
    checkInstall2([{ name: "foo", install2: { kind: "bogus", command: null } }]).some((p) => p.includes("유효하지 않음")),
    "잘못된 kind를 잡아야 함",
  );
  assert(
    checkInstall2([{ name: "foo", install2: null }]).some((p) => p.includes("객체가 아님")),
    "install2 null을 잡아야 함",
  );

  // 7) catalog 자체 이상.
  assert(
    checkCatalogSelf([{ name: "same" }, { name: "same" }]).some((p) => p.includes("중복")),
    "catalog 중복 name을 잡아야 함",
  );
  assert(
    checkCatalogSelf([{ name: "../etc/passwd" }]).some((p) => p.includes("경로위험문자")),
    "경로위험문자를 잡아야 함",
  );

  // 8) toFilename 매핑 (: 와 / 둘 다 __ 치환, route.ts의 toFilename과 대칭).
  assert(toFilename("plugin:skill") === "plugin__skill.json", "toFilename : 치환");
  assert(toFilename("a/b") === "a__b.json", "toFilename / 치환");

  // 9) 로케일 개수 하드코딩 금지: {count} 통과 / 3자리 숫자·토큰누락 FAIL.
  assert(
    checkNoHardcodedCounts([
      { locale: "ko", meta: { catalogTitle: "카탈로그 {count}종", catalogDesc: "플러그인 {count}종을 용도별" } },
    ]).length === 0,
    "{count} 플레이스홀더는 통과해야 함",
  );
  assert(
    checkNoHardcodedCounts([
      { locale: "ko", meta: { catalogTitle: "카탈로그 979종", catalogDesc: "플러그인 {count}종" } },
    ]).some((p) => p.includes("하드코딩하지 말 것")),
    "3자리 숫자 하드코딩을 잡아야 함",
  );
  assert(
    checkNoHardcodedCounts([
      { locale: "en", meta: { catalogTitle: "catalog by use case", catalogDesc: "{count} skills" } },
    ]).some((p) => p.includes("하드코딩하지 말 것")),
    "{count} 누락을 잡아야 함",
  );

  // 10) 자체 마켓 스킬 게이트: marketplace면 통과 / local·unverified로 되돌아가면 FAIL / catalog에 없으면 스킵.
  const ownMk = { marketplace: "checkup-skills", skills: ["mine"] };
  const goodOwn = [
    {
      name: "mine",
      source: "plugin:checkup-skills",
      install2: { kind: "marketplace", command: "/plugin marketplace add x77xdavid-prog/checkup-skills\n/plugin install mine@checkup-skills" },
    },
  ];
  assert(checkOwnMarketplace(goodOwn, ownMk).length === 0, "marketplace 설치인 자체 마켓 스킬은 통과해야 함");
  // 같은 스킬이 local/unverified로 되돌아가면 FAIL(로컬 스캔이 승격을 덮어쓴 경우).
  const revertedOwn = [{ name: "mine", source: "local", install2: { kind: "unverified", command: null } }];
  assert(
    checkOwnMarketplace(revertedOwn, ownMk).some((p) => p.includes("marketplace 설치가 아님")),
    "local/unverified로 되돌아간 자체 마켓 스킬을 FAIL로 잡아야 함",
  );
  // catalog에 없는 이름은 스킵(부재로 실패 금지).
  assert(checkOwnMarketplace([], { marketplace: "checkup-skills", skills: ["absent"] }).length === 0, "catalog에 없는 이름은 스킵해야 함");
  // ownMk 없으면(파일 부재) 검사 스킵 — 빈 배열.
  assert(checkOwnMarketplace(goodOwn, null).length === 0, "ownMk 없으면 스킵해야 함");

  console.log("check-catalog.mjs self-test OK");
}

// ── 진입점 ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  run();
}
