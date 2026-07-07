import ScoreCard from "./ScoreCard";
import CategoryBars from "./CategoryBars";
import SkillRecs from "./SkillRecs";
import type { Category } from "@/lib/score";
import type { Dict } from "@/lib/i18n";
import { scoreCatLabel, verdictLabel } from "@/lib/i18n-helpers";

// 가상 예시 진단서 (스펙 §2). 방문자가 스캐너 실행 전에 결과물의 가치를 먼저 보게 하는 미끼.
// 고정 데모 데이터 — 페르소나 "6개월차 사용자", 총점 58/100 (B등급은 ScoreCard가 gradeFor로 자동 산출).
// 라벨/판정어/추천은 dict로 번역. 데모 데이터의 한국어 label은 key 번역으로 대체된다.

const DEMO_TOTAL = 58; // gradeFor(58) → B

// verdict/점수는 스펙 §2 그대로. key는 스캐너·recommendations와 일치(integrations 복수).
const DEMO_CATEGORIES: Category[] = [
  { key: "basics", label: "기본 코딩 활용", score: 85, verdict: "잘씀" },
  { key: "customize", label: "커스터마이즈", score: 70, verdict: "잘씀" },
  { key: "skills", label: "스킬 생태계", score: 40, verdict: "몰라서" },
  { key: "agents", label: "에이전트 위임", score: 30, verdict: "몰라서" },
  { key: "model", label: "모델 전략", score: 60, verdict: "잘씀" },
  { key: "browser", label: "브라우저 검증", score: 20, verdict: "몰라서" },
  { key: "memory", label: "메모리·컨텍스트", score: 55, verdict: "잘씀" },
  { key: "automation", label: "자동화·스케줄", score: 10, verdict: "몰라서" },
  { key: "orchestration", label: "오케스트레이션", score: 25, verdict: "몰라서" },
  { key: "integrations", label: "외부 연동", score: 15, verdict: "불필요" },
];

// 스펙 §2: 몰라서 판정 중 이 3개에만 추천을 노출(각 상위 2개).
const DEMO_REC_KEYS = ["automation", "skills", "browser"] as const;

export default function DemoReport({ dict }: { dict: Dict }) {
  const knowGapLabel = verdictLabel(dict, "몰라서");
  return (
    <div className="mx-auto max-w-3xl">
      {/* 명확한 라벨 — 이건 가상 데이터임을 오해 없이 */}
      <div className="mb-5 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--paper-2)] px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--accent-ink)]">{dict.demo.badgeLabel}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          <strong className="font-semibold">{dict.demo.badgeStrong}</strong> {dict.demo.badgeRest}
        </p>
      </div>

      <ScoreCard total={DEMO_TOTAL} dict={dict} />

      <p className="mt-3 text-center font-mono text-xs text-[var(--ink-faint)]">{dict.demo.persona}</p>

      <div className="mt-6">
        <CategoryBars categories={DEMO_CATEGORIES} dict={dict} />
      </div>

      {/* 몰라서 3개 → 추천(상위 2개) + 설치 명령 CopyButton */}
      <section aria-labelledby="demo-recs-heading" className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
        <h3 id="demo-recs-heading" className="font-serif text-xl text-ink">
          {dict.demo.recsHeading}
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{dict.demo.recsSub}</p>
        <div className="mt-5 flex flex-col gap-5">
          {DEMO_REC_KEYS.map((key) => (
            <div key={key}>
              <p className="font-medium text-ink">
                {scoreCatLabel(dict, key)}
                <span className="ml-2 rounded-full bg-[var(--c-gap-bg)] px-2 py-0.5 font-mono text-[0.6875rem] text-[var(--accent-ink)]">
                  {knowGapLabel}
                </span>
              </p>
              <SkillRecs categoryKey={key} dict={dict} n={2} />
            </div>
          ))}
        </div>
      </section>

      {/* 하단 CTA — 스캐너 섹션으로 스크롤 */}
      <div className="mt-8 flex justify-center">
        <a href="#my-score" className="btn-accent rounded-md px-6 py-3 font-semibold">
          {dict.demo.cta}
        </a>
      </div>
    </div>
  );
}
