#!/usr/bin/env node
// 스킬 출처(provenance) 복원기 — catalog.json의 source="local" 스킬 421종의 원 공개 repo를 실측 복원.
// 실행: node scripts/build-provenance.mjs  →  data/provenance.json 재생성
//
// 조사 방법(우선순위·실증 강도 순, 추측 URL 금지):
//   1. git-remote     : 로컬 스킬 폴더 상위의 .git → `git remote get-url origin` (확정)
//   2. family-match   : ~/.claude/plugins/marketplaces/* 로컬 clone 내 동명 SKILL.md 대조
//                       (repo는 known_marketplaces.json 실측값) + gstack- 접두사 사본 매칭
//   3. skillmd-link   : SKILL.md 본문의 github.com 링크(플레이스홀더 필터) 및
//                       get-shit-done / oh-my-claudecode / everything-claude-code 참조 단서
//   4. family-match(원격): ECC·OMC repo의 git tree에서 동명 스킬 실존 대조 (gh api)
//   5. websearch      : MANUAL_MAP 상수 — gh search로 실존 확인 후 수동 채택한 것만
//   6. unknown        : 위 전부 실패 시 {"repo": null, "method": "unknown"} (정직)
//
// verified: 해당 repo의 git tree(HEAD, recursive)에서 스킬 SKILL.md/커맨드 md 실존을
//           확인한 경우만 true. gh 미인증/오프라인이면 false로 강등 (추측 금지).
// license : gh api repos/{owner}/{repo}/license 의 SPDX id. LICENSE 파일 없으면 "none",
//           repo 접근 불가면 "unknown".

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(HERE, "..", "data", "provenance.json");
const CATALOG_PATH = path.join(HERE, "..", "public", "catalog.json");

const SKILLS_DIR = path.join(HOME, ".claude", "skills");
const COMMANDS_DIR = path.join(HOME, ".claude", "commands");
const MARKETPLACES_DIR = path.join(HOME, ".claude", "plugins", "marketplaces");
const KNOWN_MP_PATH = path.join(HOME, ".claude", "plugins", "known_marketplaces.json");

const PRUNE = new Set(["node_modules", ".git", "assets", "references", "dist", "evals", "tests"]);

// ── STEP 5 상수: websearch 실측 확정분 ────────────────────────────────────────
// gh search code "gsap-core" --filename SKILL.md → greensock/gsap-skills 에
// skills/gsap-core/SKILL.md 실존 확인 (2026-07-07). "Official AI skills for GSAP".
const MANUAL_MAP = {
  "gsap-core": "greensock/gsap-skills",
  "gsap-frameworks": "greensock/gsap-skills",
  "gsap-performance": "greensock/gsap-skills",
  "gsap-plugins": "greensock/gsap-skills",
  "gsap-react": "greensock/gsap-skills",
  "gsap-scrolltrigger": "greensock/gsap-skills",
  "gsap-timeline": "greensock/gsap-skills",
  "gsap-utils": "greensock/gsap-skills",
};

// STEP 3 단서 → repo 귀속 (본문 참조 실측: gsd 스킬은 @$HOME/.claude/get-shit-done/ 참조,
// repo는 workflows/update.md의 changelog 링크로 확정. omc/ecc는 본문 명시 참조).
const CLUE_REPOS = [
  [/get-shit-done/i, "gsd-build/get-shit-done"],
  [/oh-my-claudecode|oh_my_claudecode|\.omc\//i, "Yeachan-Heo/oh-my-claudecode"],
  [/everything-claude-code/i, "affaan-m/everything-claude-code"],
];

// STEP 4: 원격 이름 대조 대상 (본문 단서 없이도 동명 스킬/커맨드가 이 repo에 실존하면 귀속)
const NAME_MATCH_REPOS = ["affaan-m/everything-claude-code", "Yeachan-Heo/oh-my-claudecode"];

// 마켓플레이스 구조 repo → 2줄 install (marketplace.json의 market/plugin 이름 실측값)
const MARKETPLACE_INSTALL = {
  "coreyhaines31/marketingskills": (name) =>
    `/plugin marketplace add coreyhaines31/marketingskills\n/plugin install marketing-skills@marketingskills`,
  "fivetaku/gptaku_plugins": (name) =>
    `/plugin marketplace add https://github.com/fivetaku/gptaku_plugins.git\n/plugin install ${name}@gptaku-plugins`,
  "Yeachan-Heo/oh-my-claudecode": () =>
    `/plugin marketplace add Yeachan-Heo/oh-my-claudecode\n/plugin install oh-my-claudecode@omc`,
  "affaan-m/everything-claude-code": () =>
    `/plugin marketplace add affaan-m/everything-claude-code\n/plugin install ecc@ecc`,
  "anthropics/claude-plugins-official": (name, plugin) =>
    `/plugin install ${plugin || name}@claude-plugins-official`,
};

// SKILL.md 링크 중 출처가 아닌 것 (문서 예시·설정 URL·PR 링크)
const PLACEHOLDER_REPOS = new Set(["org/repo", "owner/repo", "original/repo", "your-org/repo", "user/repo"]);
const NONPROV_OWNERS = new Set(["settings", "apps", "features", "orgs", "topics", "search", "sponsors"]);

// ── 공용 유틸 ─────────────────────────────────────────────────────────────────

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function ghJson(endpoint) {
  const out = sh("gh", ["api", endpoint]);
  if (!out) return null;
  try { return JSON.parse(out); } catch { return null; }
}

function normalizeRepo(url) {
  // git@github.com:o/r.git | https://github.com/o/r.git | github.com/o/r → "o/r"
  const m = String(url).match(/github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

function cleanLinkRepo(url) {
  const m = url.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
  if (!m) return null;
  const [, owner, repo] = m;
  if (NONPROV_OWNERS.has(owner) || owner === "..." || repo === "...") return null;
  const full = `${owner}/${repo.replace(/\.git$/, "")}`;
  return PLACEHOLDER_REPOS.has(full) ? null : full;
}

function parseFront(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const key of ["name", "description"]) {
    const km = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(m[1]);
    if (km) out[key] = km[1].trim().replace(/^["' ]+|["' ]+$/g, "");
  }
  return out;
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!PRUNE.has(e.name)) yield* walk(path.join(dir, e.name)); }
    else if (e.isFile() && /\.md$/i.test(e.name)) yield path.join(dir, e.name);
  }
}

// ── STEP 0: 로컬 local 스킬 수집 (build-catalog와 동일 규칙, 수정 없음·읽기만) ──

function collectLocalSkills() {
  const map = new Map(); // name → absPath
  for (const root of [SKILLS_DIR, COMMANDS_DIR]) {
    for (const f of walk(root)) {
      let text;
      try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
      const fm = parseFront(text.slice(0, 8000));
      if (!fm.description) continue;
      const base = path.basename(f);
      const isSkill = base.toUpperCase() === "SKILL.MD";
      let name = fm.name || (isSkill ? path.basename(path.dirname(f)) : base.replace(/\.md$/i, ""));
      name = name.trim().replace(/^\/+/, "");
      if (name && !map.has(name)) map.set(name, f);
    }
  }
  return map;
}

// catalog.json이 있으면 source=local 421종으로 정확히 스코프 제한
function localNamesFromCatalog() {
  try {
    const cat = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    const names = cat.filter((e) => e.source === "local").map((e) => e.name);
    return names.length ? new Set(names) : null;
  } catch { return null; }
}

// ── STEP 1: git-remote ────────────────────────────────────────────────────────

function findGitRepo(filePath) {
  // 파일에서 위로 올라가며 .git 탐지 — skills/commands 루트에서 정지 (HOME의 .git 오탐 방지)
  let dir = path.dirname(filePath);
  const stops = new Set([SKILLS_DIR, COMMANDS_DIR, path.dirname(SKILLS_DIR)]);
  while (dir && !stops.has(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      const url = sh("git", ["-C", dir, "remote", "get-url", "origin"]);
      return url ? normalizeRepo(url) : null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── STEP 2: family-match (로컬 marketplace clone 대조) ───────────────────────

function loadMarketplaceFamilies() {
  // market폴더명 → { repo, skills: Map(name → pluginName|null) }
  let known = {};
  try { known = JSON.parse(fs.readFileSync(KNOWN_MP_PATH, "utf8")); } catch {}
  const fams = [];
  for (const [mk, info] of Object.entries(known)) {
    const src = info.source || {};
    const repo = src.repo || (src.url ? normalizeRepo(src.url) : null);
    if (!repo) continue;
    const dir = path.join(MARKETPLACES_DIR, mk);
    const skills = new Map();
    for (const f of walk(dir)) {
      if (path.basename(f).toUpperCase() !== "SKILL.MD") continue;
      let text;
      try { text = fs.readFileSync(f, "utf8").slice(0, 2000); } catch { continue; }
      const fm = parseFront(text);
      const name = fm.name || path.basename(path.dirname(f));
      // plugins/<plugin>/ 세그먼트에서 플러그인명 추출 (official 마켓 install용)
      const segs = path.relative(dir, f).split(path.sep);
      let plugin = null;
      for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i] === "plugins" || segs[i] === "external_plugins") { plugin = segs[i + 1]; break; }
      }
      if (!skills.has(name)) skills.set(name, plugin);
    }
    if (skills.size) fams.push({ market: mk, repo, skills });
  }
  return fams;
}

// ── STEP 3: skillmd-link ──────────────────────────────────────────────────────

function linkFromBody(text) {
  const links = text.match(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g) || [];
  for (const l of links) {
    const r = cleanLinkRepo(l);
    if (r) return r;
  }
  for (const [re, repo] of CLUE_REPOS) if (re.test(text)) return repo;
  return null;
}

// ── VERIFY: repo git tree 캐시 → 스킬 실존 패턴 매칭 ─────────────────────────

const treeCache = new Map(); // "o/r" → { paths: string[]|null, truncated: bool }
function repoTree(repo) {
  if (treeCache.has(repo)) return treeCache.get(repo);
  const j = ghJson(`repos/${repo}/git/trees/HEAD?recursive=1`);
  const val = j && Array.isArray(j.tree)
    ? { paths: j.tree.map((t) => t.path.toLowerCase()), truncated: !!j.truncated }
    : { paths: null, truncated: false };
  treeCache.set(repo, val);
  return val;
}

function verifyInRepo(repo, name) {
  const { paths } = repoTree(repo);
  if (!paths) return false;
  const n = name.toLowerCase();
  const candidates = [
    new RegExp(`(^|/)${escapeRe(n)}/skill\\.md$`), // 표준 skills 폴더
    new RegExp(`(^|/)commands/(.+/)?${escapeRe(n)}\\.md$`), // 커맨드형
  ];
  if (n.startsWith("gsd-")) {
    candidates.push(new RegExp(`^commands/gsd/${escapeRe(n.slice(4))}\\.md$`)); // gsd-x → commands/gsd/x.md
  }
  if (repo === "garrytan/gstack" && !n.startsWith("gstack-")) {
    candidates.push(new RegExp(`(^|/)gstack-${escapeRe(n)}/skill\\.md$`)); // 접두사 사본
  }
  return paths.some((p) => candidates.some((re) => re.test(p)));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ── LICENSE ───────────────────────────────────────────────────────────────────

const licenseCache = new Map();
function repoLicense(repo) {
  if (licenseCache.has(repo)) return licenseCache.get(repo);
  let lic = "unknown";
  const j = ghJson(`repos/${repo}/license`);
  if (j && j.license && j.license.spdx_id) {
    lic = j.license.spdx_id === "NOASSERTION" ? "unknown" : j.license.spdx_id;
  } else if (ghJson(`repos/${repo}`)) {
    lic = "none"; // repo는 실존, LICENSE 파일만 없음
  }
  licenseCache.set(repo, lic);
  return lic;
}

// ── INSTALL ───────────────────────────────────────────────────────────────────

function installCmd(repo, name, plugin) {
  const mk = MARKETPLACE_INSTALL[repo];
  if (mk) return mk(name, plugin);
  return `npx skills add https://github.com/${repo} --skill ${name}`;
}

// ── 자가 체크: 파서·필터가 깨지면 즉시 실패 ──────────────────────────────────

function selfCheck() {
  console.assert(normalizeRepo("git@github.com:foo/bar.git") === "foo/bar", "ssh remote");
  console.assert(normalizeRepo("https://github.com/foo/bar.git") === "foo/bar", "https remote");
  console.assert(cleanLinkRepo("github.com/org/repo") === null, "placeholder 필터");
  console.assert(cleanLinkRepo("github.com/settings/tokens") === null, "settings 필터");
  console.assert(cleanLinkRepo("github.com/anthropics/skills") === "anthropics/skills", "정상 링크");
  console.assert(linkFromBody("see @$HOME/.claude/get-shit-done/workflows/x.md") === "gsd-build/get-shit-done", "gsd 단서");
  const re = new RegExp(`^commands/gsd/${escapeRe("new-project")}\\.md$`);
  console.assert(re.test("commands/gsd/new-project.md"), "gsd 경로 패턴");
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

function main() {
  selfCheck();

  const ghOk = !!sh("gh", ["auth", "status"]) || !!ghJson("rate_limit");
  if (!ghOk) console.warn("⚠ gh 미인증/오프라인 — verified=false, license=unknown으로 강등됩니다.");

  const localFiles = collectLocalSkills();
  const scope = localNamesFromCatalog(); // catalog의 local 421종으로 제한 (없으면 전체)
  const names = [...localFiles.keys()].filter((n) => !scope || scope.has(n)).sort();
  // catalog에 있는데 로컬 파일을 못 찾은 이름도 unknown으로 포함 (누락 금지)
  if (scope) for (const n of scope) if (!localFiles.has(n)) names.push(n);

  const families = loadMarketplaceFamilies();
  const gstackFamily = families.length ? null : null; // gstack은 STEP1 git-remote로 처리됨

  const result = {};
  const methodCount = { "git-remote": 0, "family-match": 0, "skillmd-link": 0, websearch: 0, unknown: 0 };

  for (const name of [...new Set(names)].sort()) {
    const file = localFiles.get(name);
    let repo = null, method = null, plugin = null;

    // STEP 1: git-remote
    if (file) repo = findGitRepo(file);
    if (repo) method = "git-remote";

    // STEP 2: family-match — marketplace clone 동명 + gstack- 접두사
    if (!repo) {
      for (const fam of families) {
        if (fam.skills.has(name)) { repo = fam.repo; plugin = fam.skills.get(name); method = "family-match"; break; }
        if (fam.skills.has(`gstack-${name}`)) { repo = fam.repo; method = "family-match"; break; }
      }
    }
    if (!repo && file) {
      // gstack 로컬 clone 내 gstack-<name> 사본 (marketplaces 밖, skills/gstack)
      const gstackSkill = path.join(SKILLS_DIR, "gstack", ".agents", "skills", `gstack-${name}`, "SKILL.md");
      if (fs.existsSync(gstackSkill)) { repo = "garrytan/gstack"; method = "family-match"; }
    }

    // STEP 3: skillmd-link — 본문 링크·단서
    if (!repo && file) {
      let text = "";
      try { text = fs.readFileSync(file, "utf8"); } catch {}
      repo = linkFromBody(text);
      if (repo) method = "skillmd-link";
    }

    // STEP 4: family-match(원격) — ECC/OMC tree 이름 대조
    if (!repo && ghOk) {
      for (const r of NAME_MATCH_REPOS) {
        if (verifyInRepo(r, name)) { repo = r; method = "family-match"; break; }
      }
    }

    // STEP 5: websearch 수동 확정분
    if (!repo && MANUAL_MAP[name]) { repo = MANUAL_MAP[name]; method = "websearch"; }

    // STEP 6: unknown
    if (!repo) {
      result[name] = { repo: null, method: "unknown" };
      methodCount.unknown++;
      continue;
    }

    const verified = ghOk ? verifyInRepo(repo, name) : false;
    result[name] = {
      repo: `https://github.com/${repo}`,
      method,
      install: installCmd(repo, name, plugin),
      license: ghOk ? repoLicense(repo) : "unknown",
      verified,
    };
    methodCount[method]++;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 1), "utf8");

  // ── 분포 보고 ──
  const total = Object.keys(result).length;
  const resolved = total - methodCount.unknown;
  console.log(`provenance.json 생성: ${OUT_PATH}`);
  console.log(`총 ${total}종 중 repo 확정 ${resolved} / unknown ${methodCount.unknown}`);
  console.log("방법별:", JSON.stringify(methodCount));
  const verifiedCount = Object.values(result).filter((e) => e.verified).length;
  console.log(`verified(repo 내 실존 확인): ${verifiedCount}`);
  const byLicense = {};
  for (const e of Object.values(result)) if (e.repo) byLicense[e.license] = (byLicense[e.license] || 0) + 1;
  console.log("라이선스 분포:", JSON.stringify(byLicense));
  const byRepo = {};
  for (const e of Object.values(result)) if (e.repo) byRepo[e.repo] = (byRepo[e.repo] || 0) + 1;
  console.log("상위 repo:");
  Object.entries(byRepo).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([r, n]) => console.log(`  ${r} : ${n}`));

  // PII 가드: 출력에 로컬 절대경로·사용자명 미포함 확인
  const dump = JSON.stringify(result);
  const user = path.basename(HOME);
  console.assert(!dump.includes(HOME.split(path.sep).join("/")) && !dump.includes(HOME), "로컬 경로 누출 금지");
  console.assert(!new RegExp(`Users[/\\\\]${escapeRe(user)}`).test(dump), "사용자명 경로 누출 금지");
}

main();
