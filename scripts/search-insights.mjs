#!/usr/bin/env node
// 검색 인사이트 집계 — 검색 로그에서 "신규 유스케이스 후보"를 뽑는다.
// 실행: node scripts/search-insights.mjs
//
// 현재(P1): 검색 로그는 memory 어댑터에 저장 → 서버 재시작 시 휘발 + 별도 프로세스에서
//           접근 불가. 따라서 이 스크립트는 아직 실데이터가 없다(스텁). 집계 로직만 구현·검증하고,
//           실행 시 안내를 출력한다.
// 승급(P2): lib/db 를 Supabase로 교체하면 search_logs 테이블을 읽어 aggregate()에 넘긴다.
//           (아래 loadLogs()의 TODO 지점만 채우면 동작.)

const ZERO_RESULT_MIN = 3; // N회 이상 0건 검색 → 콘텐츠 공백 후보
const UNMATCHED_MIN = 5; // N회 이상 유스케이스 미매칭(결과는 있음) → 신규 유스케이스 매핑 후보

// 순수 집계: SearchLogRecord[] → { zeroResult:[{query,count}], unmatched:[{query,count}] }.
// - zeroResult: resultCount===0 인 검색어 빈도. 카탈로그가 못 잡는 수요(콘텐츠·매핑 공백).
// - unmatched : matchedUsecase===null 이지만 결과는 있는 검색어. 잦으면 새 유스케이스 칩 후보.
export function aggregate(logs) {
  const zero = new Map();
  const unmatched = new Map();
  for (const r of logs) {
    const q = (r.query || "").trim().toLowerCase();
    if (!q) continue;
    if (r.resultCount === 0) {
      zero.set(q, (zero.get(q) || 0) + 1);
    } else if (r.matchedUsecase == null) {
      unmatched.set(q, (unmatched.get(q) || 0) + 1);
    }
  }
  const top = (m, min) =>
    [...m.entries()]
      .filter(([, c]) => c >= min)
      .sort((a, b) => b[1] - a[1])
      .map(([query, count]) => ({ query, count }));
  return { zeroResult: top(zero, ZERO_RESULT_MIN), unmatched: top(unmatched, UNMATCHED_MIN) };
}

// P2: Supabase search_logs 조회로 교체. 현재는 실데이터 없음 → 빈 배열.
async function loadLogs() {
  // TODO(P2): const { data } = await supabase.from("search_logs").select("query,matched_usecase,result_count");
  //           return data.map(d => ({ query: d.query, matchedUsecase: d.matched_usecase, resultCount: d.result_count }));
  return [];
}

async function main() {
  const logs = await loadLogs();
  if (logs.length === 0) {
    console.log("검색 인사이트: 연결된 데이터 소스 없음.");
    console.log("  P1 = memory 어댑터(휘발·프로세스 격리) → 이 스크립트에서 실데이터 접근 불가.");
    console.log("  집계 로직은 준비됨 → P2에서 loadLogs()를 Supabase 조회로 교체하면 동작.");
    console.log(`  기준: 0건 검색 ${ZERO_RESULT_MIN}회+ = 콘텐츠 공백, 미매칭 ${UNMATCHED_MIN}회+ = 신규 유스케이스 후보.`);
    return;
  }
  const { zeroResult, unmatched } = aggregate(logs);
  console.log(`검색 로그 ${logs.length}건 집계`);
  console.log("\n[0건 검색 — 콘텐츠/매핑 공백 후보]");
  for (const { query, count } of zeroResult) console.log(`  ${String(count).padStart(4)}  ${query}`);
  console.log("\n[미매칭 빈발 — 신규 유스케이스 칩 후보]");
  for (const { query, count } of unmatched) console.log(`  ${String(count).padStart(4)}  ${query}`);
}

// ── 최소 자가검증: 집계 로직이 깨지면 즉시 실패 ─────────────────────────────
function selfCheck() {
  const sample = [
    { query: "청약", matchedUsecase: null, resultCount: 0 },
    { query: "청약", matchedUsecase: null, resultCount: 0 },
    { query: "청약", matchedUsecase: null, resultCount: 0 },
    { query: "월세", matchedUsecase: null, resultCount: 12 },
    { query: "월세", matchedUsecase: null, resultCount: 12 },
    { query: "월세", matchedUsecase: null, resultCount: 12 },
    { query: "월세", matchedUsecase: null, resultCount: 12 },
    { query: "월세", matchedUsecase: null, resultCount: 12 },
    { query: "배포", matchedUsecase: "ship", resultCount: 8 }, // 매칭됨 → 후보 아님
  ];
  const { zeroResult, unmatched } = aggregate(sample);
  console.assert(zeroResult.length === 1 && zeroResult[0].query === "청약" && zeroResult[0].count === 3, "0건 집계");
  console.assert(unmatched.length === 1 && unmatched[0].query === "월세" && unmatched[0].count === 5, "미매칭 집계");
  console.assert(!unmatched.some((u) => u.query === "배포"), "매칭된 검색어는 후보 제외");
}

selfCheck();
main();
