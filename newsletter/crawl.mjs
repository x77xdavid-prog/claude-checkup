// crawl.mjs — 무키 공개 API 3개를 크롤해 정규화 JSON으로 저장.
// 각 소스는 독립 try/catch: 하나가 죽어도 나머지는 진행한다.
// 실행: node newsletter/crawl.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { DATA_DIR, dataPath, todayStr } from "./lib.mjs";

const UA = "claude-checkup-crawler/1.0 (+https://github.com/anthropics/claude-code)";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 12;

// 공통 fetch: UA 강제 + 타임아웃 + 비200이면 throw.
async function getJSON(url, { timeoutMs = 15000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- 소스 1: Hacker News (Algolia) — 최근 24h + points>=5 ---
async function crawlHN(now) {
  const url =
    "https://hn.algolia.com/api/v1/search_by_date?query=claude&tags=story&hitsPerPage=30";
  const data = await getJSON(url);
  const cutoff = now - DAY_MS;
  return (data.hits || [])
    .filter((h) => {
      const ts = new Date(h.created_at).getTime();
      const pts = h.points ?? 0;
      return Number.isFinite(ts) && ts >= cutoff && pts >= 5;
    })
    .map((h) => ({
      source: "HN",
      title: h.title || "(제목 없음)",
      // Algolia story의 외부 url이 없으면 HN 토론 링크로.
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points ?? 0,
      created_at: h.created_at,
    }));
}

// --- 소스 2: Reddit r/ClaudeAI top(day) — score>=20 ---
// ponytail: 데이터센터/CI IP는 Reddit .json 에서 403(IP 레벨 차단)이 잦다.
//   UA·호스트 변경으로 안 뚫림 — 정식 우회는 OAuth 앱 키가 필요(=무키 제약 위반).
//   설계상 이 소스 실패는 치명적이지 않음(전체 파이프라인 계속 진행).
//   승급 경로: 주거용 IP(로컬 /schedule)에서 돌리거나, P3에서 Reddit OAuth 도입.
async function crawlReddit() {
  const url = "https://www.reddit.com/r/ClaudeAI/top.json?t=day&limit=15";
  const data = await getJSON(url);
  const children = data?.data?.children || [];
  return children
    .map((c) => c.data)
    .filter((p) => p && !p.stickied && (p.score ?? 0) >= 20)
    .map((p) => ({
      source: "Reddit",
      title: p.title || "(제목 없음)",
      url: `https://www.reddit.com${p.permalink}`,
      score: p.score ?? 0,
      created_at: new Date((p.created_utc ?? 0) * 1000).toISOString(),
    }));
}

// --- 소스 3: GitHub releases anthropics/claude-code — 24h 내 것만 ---
async function crawlReleases(now) {
  const url = "https://api.github.com/repos/anthropics/claude-code/releases?per_page=3";
  const data = await getJSON(url);
  const cutoff = now - DAY_MS;
  return (Array.isArray(data) ? data : [])
    .filter((r) => {
      const ts = new Date(r.published_at || r.created_at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .map((r) => ({
      source: "릴리스",
      title: r.name || r.tag_name || "새 릴리스",
      url: r.html_url,
      score: 0, // 릴리스는 점수 개념 없음 → 0, 정렬 시 소스 우선순위로 보정
      created_at: r.published_at || r.created_at,
    }));
}

function dedupeByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

export async function crawl({ now = Date.now(), day = todayStr() } = {}) {
  const sources = [
    ["HN", crawlHN(now)],
    ["Reddit", crawlReddit()],
    ["릴리스", crawlReleases(now)],
  ];

  const perSource = {};
  const errors = {};
  const all = [];

  const settled = await Promise.allSettled(sources.map(([, p]) => p));
  settled.forEach((r, i) => {
    const name = sources[i][0];
    if (r.status === "fulfilled") {
      perSource[name] = r.value.length;
      all.push(...r.value);
    } else {
      perSource[name] = 0;
      errors[name] = String(r.reason?.message || r.reason);
    }
  });

  // 릴리스(score 0)가 정렬에서 뒤로 밀리지 않게: 릴리스는 항상 앞쪽에 두고,
  // 나머지는 score 내림차순. 그 뒤 상위 MAX_ITEMS.
  const releases = all.filter((x) => x.source === "릴리스");
  const rest = all
    .filter((x) => x.source !== "릴리스")
    .sort((a, b) => b.score - a.score);
  const merged = dedupeByUrl([...releases, ...rest]).slice(0, MAX_ITEMS);

  const payload = {
    generated_at: new Date().toISOString(),
    day,
    counts: perSource,
    errors, // 소스별 실패 사유 (없으면 빈 객체)
    items: merged,
  };
  if (merged.length === 0) {
    payload.note = "항목 0개 — 모든 소스가 필터 통과 없음 또는 실패.";
  }

  await mkdir(DATA_DIR, { recursive: true });
  const out = dataPath(day);
  await writeFile(out, JSON.stringify(payload, null, 2), "utf8");
  return { out, payload };
}

// 최소 자가검증: dedupe/정렬 로직이 깨지면 즉시 실패 (네트워크 없이).
async function selfCheck() {
  const { strict: assert } = await import("node:assert");
  const sample = [
    { source: "HN", title: "a", url: "u1", score: 10, created_at: "" },
    { source: "HN", title: "a-dup", url: "u1", score: 99, created_at: "" },
    { source: "Reddit", title: "b", url: "u2", score: 50, created_at: "" },
  ];
  const d = dedupeByUrl(sample);
  assert.equal(d.length, 2, "중복 URL 제거 실패");
  assert.equal(d[0].score, 10, "첫 등장 우선(dedupe) 실패");
  console.log("crawl.mjs self-check OK");
}

if (process.argv[1]?.endsWith("crawl.mjs")) {
  if (process.argv.includes("--self-check")) {
    await selfCheck();
  } else {
    const { out, payload } = await crawl();
    const counts = Object.entries(payload.counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`[crawl] 저장: ${out}`);
    console.log(`[crawl] 소스별 통과: ${counts} → 최종 ${payload.items.length}개`);
    if (Object.keys(payload.errors).length) {
      for (const [k, v] of Object.entries(payload.errors)) {
        console.warn(`[crawl] 소스 실패 ${k}: ${v}`);
      }
    }
  }
}
