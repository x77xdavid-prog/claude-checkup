import { gradeFor } from "@/lib/score";

// 총점 대형 숫자 + 도장 등급 뱃지 + 한 줄 총평. 서버 컴포넌트.
export default function ScoreCard({ total }: { total: number }) {
  const grade = gradeFor(total);
  const stampClass = grade.tone === "high" ? "stamp--good" : grade.tone === "low" ? "stamp--low" : "";

  return (
    <section
      aria-labelledby="score-heading"
      className="paper-card relative rounded-xl px-6 py-8 sm:px-10 sm:py-10"
    >
      {/* 상단 라벨 — 진단서 헤더 느낌 */}
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">
        CLAUDE CODE 활용 진단서
      </p>
      <h2 id="score-heading" className="sr-only">
        진단 총점 {total}점, 등급 {grade.letter}
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-3">
          <span className="font-mono text-[5.5rem] leading-[0.85] font-bold text-ink sm:text-[7rem]">
            {total}
          </span>
          <span className="mb-2 font-serif text-2xl text-[var(--ink-soft)]">/ 100</span>
        </div>

        {/* 도장 등급 */}
        <div
          className={`stamp ${stampClass} h-24 w-24 text-5xl sm:h-28 sm:w-28 sm:text-6xl`}
          aria-hidden
        >
          {grade.letter}
        </div>
      </div>

      <p className="mt-6 max-w-prose font-serif text-xl leading-snug text-ink sm:text-2xl">
        {grade.headline}
      </p>
    </section>
  );
}
