import { gradeFor } from "@/lib/score";
import type { Dict } from "@/lib/i18n";
import { gradeHeadline } from "@/lib/i18n-helpers";

// 총점 대형 숫자 + 도장 등급 뱃지 + 한 줄 총평. 서버 컴포넌트.
// 등급 letter/tone은 gradeFor(점수 로직), 총평 문구는 사전에서 letter로 조회.
export default function ScoreCard({ total, dict }: { total: number; dict: Dict }) {
  const grade = gradeFor(total);
  const stampClass = grade.tone === "high" ? "stamp--good" : grade.tone === "low" ? "stamp--low" : "";
  const headline = gradeHeadline(dict, grade.letter);
  const srTotal = dict.score.srTotal.replace("{total}", String(total)).replace("{grade}", grade.letter);

  return (
    <section
      aria-labelledby="score-heading"
      className="paper-card relative rounded-xl px-6 py-8 sm:px-10 sm:py-10"
    >
      {/* 상단 라벨 — 진단서 헤더 느낌 */}
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">
        {dict.score.cardLabel}
      </p>
      <h2 id="score-heading" className="sr-only">
        {srTotal}
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-3">
          <span className="font-mono text-[5.5rem] leading-[0.85] font-bold text-ink sm:text-[7rem]">
            {total}
          </span>
          <span className="mb-2 font-serif text-2xl text-[var(--ink-soft)]">{dict.score.outOf}</span>
        </div>

        {/* 도장 등급 */}
        <div
          className={`stamp stamp-in ${stampClass} h-24 w-24 text-5xl sm:h-28 sm:w-28 sm:text-6xl`}
          aria-hidden
        >
          {grade.letter}
        </div>
      </div>

      <p className="mt-6 max-w-prose font-serif text-xl leading-snug text-ink sm:text-2xl">
        {headline}
      </p>
    </section>
  );
}
