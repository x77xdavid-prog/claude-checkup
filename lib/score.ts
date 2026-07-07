// 점수 루브릭 (스펙 §5). 서버가 총점을 재계산하는 단일 진실 소스.
// 클라이언트가 보낸 총점은 신뢰하지 않는다 — categories의 score만 받아 여기서 가중 평균.

export const VERDICTS = ["잘씀", "몰라서", "불필요"] as const;
export type Verdict = (typeof VERDICTS)[number];

// 스펙 §5의 10개 영역: key → { 가중치, 라벨 }. 가중치 합 = 100.
// 카탈로그/스캐너와 공유되는 안정적 key. 순서 = 결과 페이지 표시 순서.
export const CATEGORY_META = {
  basics: { weight: 15, label: "기본 코딩 활용" },
  customize: { weight: 10, label: "커스터마이즈" },
  skills: { weight: 15, label: "스킬 생태계" },
  agents: { weight: 10, label: "에이전트 위임" },
  model: { weight: 5, label: "모델 전략" },
  browser: { weight: 10, label: "브라우저 검증" },
  memory: { weight: 10, label: "메모리·컨텍스트" },
  automation: { weight: 15, label: "자동화·스케줄" },
  orchestration: { weight: 5, label: "오케스트레이션" },
  integration: { weight: 5, label: "외부 연동" },
} as const;

export type CategoryKey = keyof typeof CATEGORY_META;

export const CATEGORY_KEYS = Object.keys(CATEGORY_META) as CategoryKey[];

export interface Category {
  key: string; // 알려진 key면 CATEGORY_META로 가중치 매핑, 아니면 fallbackWeight
  label: string;
  score: number; // 0~100
  verdict: Verdict;
}

// 가중 평균 총점. 알려지지 않은 key는 균등 fallback 가중치로 처리(스캐너가 미래에 영역 추가해도 깨지지 않게).
// 반환: 0~100 정수.
export function computeTotal(categories: Category[]): number {
  if (categories.length === 0) return 0;
  const fallbackWeight = 5;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of categories) {
    const meta = (CATEGORY_META as Record<string, { weight: number }>)[c.key];
    const weight = meta ? meta.weight : fallbackWeight;
    const score = clampScore(c.score);
    weightedSum += score * weight;
    weightTotal += weight;
  }
  if (weightTotal === 0) return 0;
  return Math.round(weightedSum / weightTotal);
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

// 총점 → 등급 라벨(성적표 메타포). 도장 뱃지에 쓰인다.
export interface Grade {
  letter: string; // 도장에 크게 찍히는 글자
  headline: string; // 한 줄 총평
  tone: "high" | "mid" | "low";
}

export function gradeFor(total: number): Grade {
  if (total >= 85) {
    return { letter: "S", headline: "클로드를 제대로 부리는 상위 사용자", tone: "high" };
  }
  if (total >= 70) {
    return { letter: "A", headline: "잘 쓰고 있어요. 한두 곳만 채우면 최상위", tone: "high" };
  }
  if (total >= 55) {
    return { letter: "B", headline: "기본은 탄탄. 자동화·위임에서 점수가 샙니다", tone: "mid" };
  }
  if (total >= 40) {
    return { letter: "C", headline: "코딩엔 쓰지만 절반의 기능을 놓치는 중", tone: "mid" };
  }
  if (total >= 20) {
    return { letter: "D", headline: "채팅 수준 활용. 개선 여지가 아주 큽니다", tone: "low" };
  }
  return { letter: "F", headline: "이제 막 시작. 아래 순서대로 채워보세요", tone: "low" };
}

// verdict → 색 토큰(CSS 변수 이름). 컴포넌트가 이걸로 막대/뱃지 색을 고른다.
// 잘씀=녹색 / 몰라서=주황 / 불필요=회색.
export function verdictColor(verdict: Verdict): string {
  switch (verdict) {
    case "잘씀":
      return "var(--c-good)";
    case "몰라서":
      return "var(--c-gap)";
    case "불필요":
      return "var(--c-skip)";
    default:
      return "var(--c-skip)";
  }
}

// "몰라서 못 쓰는 것" 상위 N개 추출 — 점수 낮은 순. 결과 페이지 개선 액션 대상.
export function topGaps(categories: Category[], n = 3): Category[] {
  return categories
    .filter((c) => c.verdict === "몰라서")
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
}

// 영역별 개선 액션 텍스트. key 기준(라벨은 바뀔 수 있으니 key로 매핑). 없으면 일반 문구.
export const IMPROVE_ACTIONS: Record<string, string> = {
  basics: "실제 프로젝트를 열어 세션을 이어가며 작업해 보세요. 대화형보다 파일 기반이 남습니다.",
  customize: "settings.json에 훅을, 프로젝트 루트에 CLAUDE.md를 두면 반복 지시가 사라집니다.",
  skills: "카탈로그에서 자주 하는 작업에 맞는 스킬을 골라 설치 명령을 복사하세요.",
  agents: "무거운 작업은 서브에이전트에 위임하면 메인 컨텍스트가 가벼워집니다.",
  model: "작업 난이도별로 모델을 지정하세요. 잡무는 가벼운 모델, 설계는 강한 모델.",
  browser: "Playwright/브라우저 MCP를 붙이면 UI를 눈으로 검증하고 스크린샷으로 확인합니다.",
  memory: "memory/와 계층형 CLAUDE.md로 컨텍스트를 파일에 남기면 대화가 끊겨도 이어집니다.",
  automation: "훅과 cron/워크플로로 포맷·테스트·다이제스트를 자동화하세요.",
  orchestration: "팀·워크플로 스킬로 여러 에이전트를 병렬 지휘하면 처리량이 올라갑니다.",
  integration: "필요한 외부 도구를 MCP 서버로 연결하면 손이 훨씬 덜 갑니다.",
};

export function improveActionFor(key: string): string {
  return IMPROVE_ACTIONS[key] ?? "카탈로그에서 관련 스킬과 설정을 찾아 적용해 보세요.";
}

// ── 최소 자가검증 (assert) ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const eq = (a: unknown, b: unknown, m: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`FAIL ${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  // 가중치 합 100
  eq(
    Object.values(CATEGORY_META).reduce((s, c) => s + c.weight, 0),
    100,
    "가중치 합",
  );
  // 전부 100점이면 총점 100
  const allFull: Category[] = CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_META[k].label, score: 100, verdict: "잘씀" }));
  eq(computeTotal(allFull), 100, "만점");
  // 전부 0점이면 0
  eq(computeTotal(allFull.map((c) => ({ ...c, score: 0 }))), 0, "빵점");
  // 가중 평균: basics(15)만 100, 나머지 0 → 15
  eq(computeTotal(CATEGORY_KEYS.map((k) => ({ key: k, label: "", score: k === "basics" ? 100 : 0, verdict: "잘씀" }))), 15, "가중");
  // clamp
  eq(clampScore(150), 100, "clamp 상한");
  eq(clampScore(-5), 0, "clamp 하한");
  eq(clampScore(NaN), 0, "clamp NaN");
  // topGaps: 몰라서만, 점수 오름차순
  const gaps = topGaps([
    { key: "a", label: "", score: 30, verdict: "몰라서" },
    { key: "b", label: "", score: 10, verdict: "몰라서" },
    { key: "c", label: "", score: 5, verdict: "불필요" },
    { key: "d", label: "", score: 20, verdict: "몰라서" },
  ]);
  eq(gaps.map((g) => g.key), ["b", "d", "a"], "topGaps 정렬/필터");
  eq(gradeFor(100).letter, "S", "grade S");
  eq(gradeFor(0).letter, "F", "grade F");
  console.log("score.ts self-check OK");
}
