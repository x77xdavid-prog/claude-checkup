import type { Dict } from "@/lib/i18n";

// 스캔 개수 타일 — 스킬·에이전트·훅·플러그인·MCP·세션. 서버 컴포넌트.
// meta.totals(개수만·개인정보 없음)를 큰 모노 숫자로 표시. 라벨은 사전에서.
// 모바일 2열 → sm 3열 → lg 6열. 각 타일 상단에 주황 액센트 선.

// { totals의 key, 사전 라벨 key } — mcpServers는 라벨 key가 짧게 mcp.
const TILES: ReadonlyArray<{ total: string; label: string }> = [
  { total: "skills", label: "skills" },
  { total: "agents", label: "agents" },
  { total: "hooks", label: "hooks" },
  { total: "plugins", label: "plugins" },
  { total: "mcpServers", label: "mcp" },
  { total: "sessions", label: "sessions" },
];

// 안전 포맷 — 음수·비유한값 방어 + 천 단위 구분(결정적: en-US, 하이드레이션 무관 서버 렌더).
function fmt(n: number): string {
  return Number.isFinite(n) ? Math.max(0, Math.round(n)).toLocaleString("en-US") : "0";
}

export default function StatTiles({ totals, dict }: { totals: Record<string, number>; dict: Dict }) {
  const labels = dict.result.stats as Record<string, string>;
  return (
    <section className="paper-card rounded-xl px-5 py-6 sm:px-8 sm:py-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => (
          <div
            key={t.total}
            className="rounded-lg border border-t-2 border-[var(--line-strong)] border-t-[var(--accent)] bg-[var(--paper-2)] px-3 py-4 text-center"
          >
            <div className="font-mono text-3xl font-bold leading-none tabular-nums text-ink sm:text-4xl">
              {fmt(totals[t.total] ?? 0)}
            </div>
            <div className="mt-2 text-xs font-medium tracking-wide text-[var(--ink-soft)]">
              {labels[t.label] ?? t.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
