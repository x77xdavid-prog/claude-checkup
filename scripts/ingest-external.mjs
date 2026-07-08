#!/usr/bin/env node
// 외부 GitHub 스킬 컬렉션 수집 파이프라인 (재사용 가능).
// 입력: data/external-sources.json → 각 repo의 SKILL.md를 gh로 트리 조회 →
//   raw.githubusercontent에서 frontmatter fetch(동시 8, 실패 skip 기록) → 항목 생성 →
//   data/external/{repo}.json 캐시. 병합·최종 catalog.json은 build-catalog.mjs가 담당.
// gh는 인증돼 있어 rate limit 5000/hr — 트리 조회는 반드시 gh 사용(무인증 API fetch 금지).
//   (frontmatter는 raw CDN이라 무인증 fetch가 정상 경로 — API rate limit과 무관.)
// 실행: node scripts/ingest-external.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFront, classify, DESC_MAX } from "./skill-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CONCURRENCY = 8;
const RAW = "https://raw.githubusercontent.com";

// gh api 호출(동기, 인증됨). --jq 없이 원문 JSON을 받아 Node에서 파싱(셸 인용 이슈 회피).
// Windows에서 execFile이 확장자 미해결로 ENOENT면 셸 경유로 1회 재시도.
function gh(args) {
  const opts = { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] };
  try {
    return execFileSync("gh", args, opts);
  } catch (e) {
    if (e && e.code === "ENOENT") return execFileSync("gh", args, { ...opts, shell: true });
    throw e;
  }
}

// repo 슬러그 → 캐시 파일명(경로 특수문자 제거).
function slugToFile(repo) {
  return repo.replace(/[^a-zA-Z0-9._-]+/g, "__") + ".json";
}

// repo의 모든 SKILL.md 경로. 닷-디렉터리(.gemini 등 미러·설정)는 제외 — 중복 이름 방지.
function listSkillPaths(repo, branch) {
  const raw = gh(["api", `repos/${repo}/git/trees/${branch}?recursive=1`]);
  const tree = JSON.parse(raw).tree || [];
  return tree
    .map((t) => t.path)
    .filter((p) => typeof p === "string" && p.endsWith("SKILL.md") && !p.startsWith("."));
}

// 마켓플레이스 매핑 로드: .claude-plugin/marketplace.json → {market, sources[최장 prefix 우선]}.
// 없으면 null(비마켓 repo → 전부 npx fallback).
function loadMarketplace(repo, branch) {
  let json;
  try {
    json = gh(["api", `repos/${repo}/contents/.claude-plugin/marketplace.json?ref=${branch}`]);
  } catch {
    return null;
  }
  let mp;
  try {
    const content = JSON.parse(json).content || "";
    mp = JSON.parse(Buffer.from(content, "base64").toString("utf8"));
  } catch {
    return null;
  }
  const market = typeof mp.name === "string" ? mp.name : null;
  const plugins = Array.isArray(mp.plugins) ? mp.plugins : [];
  const sources = plugins
    .filter((p) => p && typeof p.name === "string" && typeof p.source === "string")
    .map((p) => ({ name: p.name, src: p.source.replace(/^\.\//, "").replace(/\/+$/, "") }))
    .sort((a, b) => b.src.length - a.src.length); // 최장 prefix가 먼저 매치되도록
  return market ? { market, sources } : null;
}

// 경로 → 플러그인명(최장 prefix 매치). 없으면 null.
function pluginFor(p, sources) {
  for (const s of sources) if (p.startsWith(s.src + "/")) return s.name;
  return null;
}

// install2 도출 — 외부는 항상 verified-repo(SKILL.md 실존 = 검증). 마켓 매핑되면 2줄, 아니면 npx.
function externalInstall2(repo, name, plugin, mp) {
  if (mp && mp.market && plugin) {
    return { kind: "verified-repo", command: `/plugin marketplace add ${repo}\n/plugin install ${plugin}@${mp.market}`, license: "MIT" };
  }
  return { kind: "verified-repo", command: `npx skills add https://github.com/${repo} --skill ${name}`, license: "MIT" };
}

// 동시성 제한 map. fn은 던지지 않고 결과 반환(실패도 값으로).
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

// raw fetch → frontmatter 파싱. 네트워크/HTTP 실패 1회 재시도. 반환 {ok, front|reason}.
async function fetchFront(repo, branch, p) {
  const url = `${RAW}/${repo}/${branch}/${p.split("/").map(encodeURIComponent).join("/")}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (attempt === 0) continue;
        return { ok: false, reason: `HTTP ${res.status}` };
      }
      const text = (await res.text()).slice(0, 8000); // frontmatter는 최상단 → 8KB로 충분
      return { ok: true, front: parseFront(text) };
    } catch (e) {
      if (attempt === 0) continue;
      return { ok: false, reason: String((e && e.message) || e) };
    }
  }
}

async function ingestRepo(src, localNames) {
  const { repo, branch = "main", label = repo, marketplace = false } = src;
  console.log(`\n▶ ${repo}@${branch} — "${label}"${marketplace ? " (marketplace)" : ""}`);

  const paths = listSkillPaths(repo, branch);
  console.log(`  SKILL.md 경로(닷-디렉터리 제외): ${paths.length}`);

  const mp = marketplace ? loadMarketplace(repo, branch) : null;
  if (marketplace) console.log(mp ? `  마켓: ${mp.market} · 플러그인 소스 ${mp.sources.length}` : "  ⚠ marketplace.json 로드 실패 → 전부 npx fallback");

  const fetched = await mapLimit(paths, CONCURRENCY, (p) => fetchFront(repo, branch, p));

  const byName = new Map(); // 외부 내부 dedup(설명 긴 쪽 유지)
  const failures = [];
  let noDesc = 0;
  for (let k = 0; k < paths.length; k++) {
    const r = fetched[k];
    if (!r || !r.ok) {
      failures.push({ path: paths[k], reason: (r && r.reason) || "unknown" });
      continue;
    }
    const fm = r.front || {};
    const description = (fm.description || "").trim();
    if (!description) { noDesc++; continue; } // 설명 없으면 카탈로그 가치 없음
    let name = (fm.name || path.basename(path.dirname(paths[k]))).trim().replace(/^\/+/, "");
    if (!name) { noDesc++; continue; }
    const desc = description.slice(0, DESC_MAX);
    const plugin = mp ? pluginFor(paths[k], mp.sources) : null;
    const entry = {
      name,
      description: desc,
      category: classify(name, desc),
      source: `external:${repo}`,
      collection: label,
      install2: externalInstall2(repo, name, plugin, mp),
    };
    const prev = byName.get(name);
    if (!prev || entry.description.length > prev.description.length) byName.set(name, entry);
  }

  const items = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  // 캐시는 완전한 컬렉션 보존(로컬 충돌 skip은 build-catalog가 최종 수행). 여기선 충돌만 리포트.
  const collide = items.filter((e) => localNames.has(e.name)).map((e) => e.name);

  const outDir = path.join(ROOT, "data", "external");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, slugToFile(repo));
  fs.writeFileSync(outPath, JSON.stringify(items, null, 1), "utf8");

  const mapped = items.filter((e) => e.install2.command.startsWith("/plugin")).length;
  console.log(`  수집 성공: ${items.length}  (fetch 실패 ${failures.length} · 설명없음 ${noDesc} · 내부중복 제거 후)`);
  console.log(`  install: marketplace ${mapped} · npx fallback ${items.length - mapped}`);
  console.log(`  로컬충돌(build-catalog에서 skip 예정): ${collide.length}${collide.length ? " → " + collide.join(", ") : ""}`);
  if (failures.length) {
    console.log("  실패 상세(최대 10):");
    for (const f of failures.slice(0, 10)) console.log(`    ${f.path} — ${f.reason}`);
  }
  console.log(`  캐시: ${outPath}`);
  return { repo, collected: items.length, failed: failures.length, noDesc, collide: collide.length };
}

// 로컬 카탈로그 이름 집합(source가 external: 아닌 것) — 충돌 리포트 기준.
function loadLocalNames() {
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "catalog.json"), "utf8"));
    if (Array.isArray(cat)) {
      return new Set(
        cat
          .filter((e) => e && typeof e.name === "string" && !(typeof e.source === "string" && e.source.startsWith("external:")))
          .map((e) => e.name),
      );
    }
  } catch {
    /* 카탈로그 아직 없음 → 충돌 없음으로 취급 */
  }
  return new Set();
}

// ── 자가 체크(순수, 네트워크 없음) — 최장 prefix·install2·slug이 깨지면 즉시 실패 ──
(function selfCheck() {
  const assert = (c, m) => {
    if (!c) throw new Error("self-check FAIL: " + m);
  };
  const srcs = [
    { name: "eng", src: "engineering" },
    { name: "pw", src: "engineering/playwright-pro" },
  ].sort((a, b) => b.src.length - a.src.length);
  assert(pluginFor("engineering/playwright-pro/skills/x/SKILL.md", srcs) === "pw", "최장 prefix 우선");
  assert(pluginFor("engineering/foo/skills/y/SKILL.md", srcs) === "eng", "짧은 prefix 매치");
  assert(pluginFor("other/x/SKILL.md", srcs) === null, "무매치 → null");
  const mpI = externalInstall2("a/b", "aeo", "aeo", { market: "m" });
  assert(mpI.command === "/plugin marketplace add a/b\n/plugin install aeo@m" && mpI.license === "MIT", "marketplace install");
  const npxI = externalInstall2("a/b", "loop", null, { market: "m" });
  assert(npxI.command === "npx skills add https://github.com/a/b --skill loop", "npx fallback");
  assert(slugToFile("alirezarezvani/claude-skills") === "alirezarezvani__claude-skills.json", "slug 파일명화");
})();

async function main() {
  const cfgPath = path.join(ROOT, "data", "external-sources.json");
  let sources;
  try {
    sources = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {
    console.error(`external-sources.json 읽기 실패: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(sources) || sources.length === 0) {
    console.error("external-sources.json 이 비었거나 배열이 아님");
    process.exit(1);
  }

  const localNames = loadLocalNames();
  console.log(`로컬 카탈로그 이름 ${localNames.size}종(충돌 판정 기준)`);

  const summary = [];
  for (const src of sources) {
    if (!src || typeof src.repo !== "string") {
      console.warn("잘못된 소스 항목 스킵:", JSON.stringify(src));
      continue;
    }
    summary.push(await ingestRepo(src, localNames));
  }

  console.log("\n═══ 수집 요약 ═══");
  for (const s of summary) {
    console.log(`  ${s.repo}: 수집 ${s.collected} · fetch실패 ${s.failed} · 설명없음 ${s.noDesc} · 로컬충돌 ${s.collide}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
