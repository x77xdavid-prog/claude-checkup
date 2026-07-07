import { verdictColor, type Category } from "@/lib/score";

// 영역별 가로 막대. 색: 잘씀=녹색 / 몰라서=주황 / 불필요=회색 (verdictColor).
// 서버 컴포넌트. 막대는 CSS 폭(%)만 — 애니메이션 불필요.
export default function CategoryBars({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="bars-heading" className="paper-card rounded-xl px-5 py-6 sm:px-8 sm:py-7">
      <h2 id="bars-heading" className="mb-5 font-serif text-xl text-ink">
        영역별 진단
      </h2>
      <ul className="flex flex-col gap-4">
        {categories.map((c) => (
          <li key={c.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{c.label}</span>
              <span className="flex items-center gap-2">
                <VerdictTag verdict={c.verdict} />
                <span className="font-mono text-sm tabular-nums text-[var(--ink-soft)]">{c.score}</span>
              </span>
            </div>
            <div
              className="h-3 w-full overflow-hidden rounded-sm border border-[var(--line-strong)] bg-[var(--paper-2)]"
              role="img"
              aria-label={`${c.label} ${c.score}점, ${c.verdict}`}
            >
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${Math.max(2, Math.min(100, c.score))}%`,
                  background: verdictColor(c.verdict),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VerdictTag({ verdict }: { verdict: Category["verdict"] }) {
  const map: Record<string, { bg: string; fg: string }> = {
    잘씀: { bg: "var(--c-good-bg)", fg: "var(--c-good)" },
    몰라서: { bg: "var(--c-gap-bg)", fg: "var(--accent-ink)" },
    불필요: { bg: "var(--c-skip-bg)", fg: "var(--ink-soft)" },
  };
  const s = map[verdict] ?? map["불필요"];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {verdict}
    </span>
  );
}
