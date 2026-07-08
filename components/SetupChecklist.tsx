import type { Dict } from "@/lib/i18n";

// 설치 체크리스트 — flags 6개를 [x]/[ ] 모노 리스트로. 서버 컴포넌트.
// 켜짐=주황 [x]/잉크 텍스트, 꺼짐=흐린 [ ]/흐린 텍스트. 데스크톱 2열로 밀도↑.

// flags key 순서 = 표시 순서. 라벨은 dict.result.setup[key].
const ITEMS = ["hasClaudeMd", "hasMemory", "modelConfigured", "hasPlaywright", "hasCron", "hasWorkflows"] as const;

export default function SetupChecklist({ flags, dict }: { flags: Record<string, boolean>; dict: Dict }) {
  const labels = dict.result.setup as Record<string, string>;
  return (
    <section aria-labelledby="setup-heading" className="paper-card rounded-xl px-5 py-6 sm:px-8 sm:py-7">
      <h2 id="setup-heading" className="mb-4 font-serif text-xl text-ink">
        {dict.result.setupTitle}
      </h2>
      <ul className="grid grid-cols-1 gap-2 font-mono text-sm sm:grid-cols-2">
        {ITEMS.map((k) => {
          const on = !!flags[k];
          return (
            <li key={k} className={`flex items-center gap-2 ${on ? "text-ink" : "text-[var(--ink-faint)]"}`}>
              <span className={on ? "text-[var(--accent-ink)]" : "text-[var(--ink-faint)]"} aria-hidden>
                {on ? "[x]" : "[ ]"}
              </span>
              <span>{labels[k] ?? k}</span>
              <span className="sr-only">{on ? "✓" : "✗"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
