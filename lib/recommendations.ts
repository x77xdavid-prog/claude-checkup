// 카테고리별 스킬/기능 추천 데이터 (스펙 §1 — 창작 금지, 검증 안 된 설치 URL 금지).
// key = 스캐너(scanner/checkup.mjs)가 보내는 카테고리 key와 일치해야 조회된다.
// type=builtin → "Claude Code 내장 — 설치 불필요" 뱃지. install → 설치 명령을 CopyButton으로.

export type RecType = "builtin" | "install";

export interface Rec {
  name: string;
  tip: string;
  command: string;
  type: RecType;
}

export interface CategoryRec {
  key: string;
  why: string;
  recs: Rec[];
}

// 순서·문구·명령은 스펙 그대로. 새 설치 명령을 지어내지 말 것.
export const RECOMMENDATIONS: Record<string, CategoryRec> = {
  basics: {
    key: "basics",
    why: "플랜 모드와 프로세스 스킬만 익혀도 재작업이 급감합니다",
    recs: [
      { name: "플랜 모드", tip: "큰 작업 전 Shift+Tab — 계획 승인 후 실행", command: "Shift+Tab (대화 중)", type: "builtin" },
      {
        name: "superpowers",
        tip: "브레인스토밍·TDD·디버깅 프로세스 규율 스킬팩",
        command: "/plugin marketplace add obra/superpowers-marketplace 후 /plugin install superpowers@superpowers-marketplace",
        type: "install",
      },
    ],
  },
  customize: {
    key: "customize",
    why: "훅과 CLAUDE.md가 반복 지시를 없애줍니다",
    recs: [
      { name: "CLAUDE.md", tip: "프로젝트 루트에 규칙 파일 — 매 세션 자동 적용", command: "/init", type: "builtin" },
      { name: "훅(hooks)", tip: "저장 시 포맷·검증 자동화", command: "settings.json의 hooks 항목 (또는 /hooks)", type: "builtin" },
    ],
  },
  skills: {
    key: "skills",
    why: "스킬은 설치해두면 키워드만으로 자동 발동합니다",
    recs: [
      {
        name: "insane-search",
        tip: "차단된 사이트(레딧·X·유튜브 등)를 뚫는 리더",
        command: "/plugin marketplace add https://github.com/fivetaku/gptaku_plugins.git 후 /plugin install insane-search@gptaku-plugins",
        type: "install",
      },
      {
        name: "caveman",
        tip: "출력 토큰 65% 절감 — 코드·에러는 그대로",
        command: "github.com/juliusbrussee/caveman 의 SKILL.md를 ~/.claude/skills/caveman/ 에 복사",
        type: "install",
      },
      {
        name: "taste-skill",
        tip: "AI 티 나는 템플릿 UI 탈출 — 프론트 디자인 스킬",
        command: "npx skills add https://github.com/Leonxlnx/taste-skill",
        type: "install",
      },
    ],
  },
  agents: {
    key: "agents",
    why: "독립 작업을 병렬 위임하면 체감 속도가 2~3배",
    recs: [
      {
        name: "서브에이전트 위임",
        tip: '"이 두 작업 서브에이전트로 병렬로 해줘"라고 말하기',
        command: "별도 설치 불필요 — 요청만 하면 됨",
        type: "builtin",
      },
      { name: "커스텀 에이전트", tip: "~/.claude/agents/에 역할별 에이전트 정의", command: "/agents", type: "builtin" },
    ],
  },
  model: {
    key: "model",
    why: "작업 난이도에 모델을 맞추면 비용·속도가 최적화됩니다",
    recs: [{ name: "모델 전환", tip: "무거운 설계는 상위 모델, 잡무는 Haiku", command: "/model", type: "builtin" }],
  },
  browser: {
    key: "browser",
    why: '만든 걸 브라우저로 실측 검증해야 "된다"고 말할 수 있습니다',
    recs: [
      {
        name: "Playwright MCP",
        tip: "클로드가 직접 브라우저를 열어 클릭·스크린샷 검증",
        command: "claude mcp add playwright -- npx @playwright/mcp@latest",
        type: "install",
      },
    ],
  },
  memory: {
    key: "memory",
    why: "세션이 끊겨도 맥락이 이어지게",
    recs: [
      { name: "CLAUDE.md 계층", tip: "전역(~/.claude)+프로젝트별 규칙 분리", command: "/init 및 ~/.claude/CLAUDE.md", type: "builtin" },
      { name: "# 메모리", tip: '대화에서 "이거 기억해"라고 말하면 영구 저장', command: '# 로 시작하는 메시지 또는 "기억해"', type: "builtin" },
    ],
  },
  automation: {
    key: "automation",
    why: "가장 저평가된 영역 — 반복 작업을 무인화하면 매일 시간이 돌아옵니다",
    recs: [
      { name: "/schedule", tip: "매일/매주 자동 실행 루틴 (크론)", command: "/schedule", type: "builtin" },
      { name: "/loop", tip: "조건 반복·폴링 자동화", command: "/loop 10m <할일>", type: "builtin" },
      { name: "백그라운드 실행", tip: "긴 빌드는 뒤로 돌리고 다음 작업 계속", command: '"백그라운드로 돌려줘"', type: "builtin" },
    ],
  },
  orchestration: {
    key: "orchestration",
    why: "큰 작업은 팀처럼 — 계획·실행·검증 에이전트 분업",
    recs: [
      {
        name: "병렬 에이전트",
        tip: "독립 태스크 동시 실행 + 검증 에이전트로 교차확인",
        command: '"에이전트 3개로 나눠서 병렬로 해줘"',
        type: "builtin",
      },
    ],
  },
  integrations: {
    key: "integrations",
    why: "쓰는 서비스가 있을 때만 — 없으면 이 영역은 무시해도 됩니다",
    recs: [
      { name: "MCP 서버", tip: "GitHub·Slack 등 외부 도구 연결", command: "claude mcp (대화형) 또는 claude mcp add", type: "builtin" },
    ],
  },
};

// verdict "몰라서" 카테고리 key로 추천 조회. 상위 n개만. 없으면 빈 배열.
// 스캐너가 "integration"(단수)를 보낼 가능성 대비: 별칭 매핑.
const KEY_ALIASES: Record<string, string> = { integration: "integrations" };

export function recsFor(key: string, n = 2): Rec[] {
  const canonical = KEY_ALIASES[key] ?? key;
  const entry = RECOMMENDATIONS[canonical];
  if (!entry) return [];
  return entry.recs.slice(0, n);
}

export function categoryRecFor(key: string): CategoryRec | null {
  const canonical = KEY_ALIASES[key] ?? key;
  return RECOMMENDATIONS[canonical] ?? null;
}

// ── 최소 자가검증 (assert) ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const assert = (cond: boolean, m: string) => {
    if (!cond) throw new Error("FAIL " + m);
  };
  // 모든 rec은 필수 필드를 갖는다
  for (const [k, entry] of Object.entries(RECOMMENDATIONS)) {
    assert(entry.key === k, `key 일치 ${k}`);
    assert(entry.why.length > 0, `why 존재 ${k}`);
    assert(entry.recs.length > 0, `recs 존재 ${k}`);
    for (const r of entry.recs) {
      assert(r.name.length > 0 && r.command.length > 0, `rec 필드 ${k}/${r.name}`);
      assert(r.type === "builtin" || r.type === "install", `rec type ${k}/${r.name}`);
    }
  }
  // recsFor: 상위 n개
  assert(recsFor("skills", 2).length === 2, "recsFor 상위2");
  assert(recsFor("model", 5).length === 1, "recsFor 항목수 초과 clamp");
  assert(recsFor("없는키").length === 0, "recsFor 미지의 key");
  // 별칭
  assert(recsFor("integration").length === recsFor("integrations").length, "integration 별칭");
  console.log("recommendations.ts self-check OK");
}
