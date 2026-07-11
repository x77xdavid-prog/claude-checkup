"use client";

import { catCatLabel } from "@/lib/i18n-helpers";
import { ALL, type CatalogFilterProps } from "./catalog-shared";

// ③ 데스크톱(lg+) 카테고리 사이드바 — "전체(계산값)" + 카테고리별 카운트 + 컬렉션(접이식).
// 카운트는 전부 부모 useMemo 계산값(하드코딩 숫자 금지). lg 미만은 FilterSheet가 같은 역할.
// 카테고리·컬렉션은 기존과 동일하게 AND 필터(내부 값은 한국어 카테고리 그대로 — 검색·필터 일관).

function SidebarRow({
  on,
  label,
  count,
  onClick,
}: {
  on: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        on
          ? "bg-[var(--c-gap-bg)] font-semibold text-[var(--accent-ink)]"
          : "text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-ink"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className={`shrink-0 font-mono text-xs ${on ? "text-[var(--accent-ink)]" : "text-[var(--ink-faint)]"}`}>
        {count}
      </span>
    </button>
  );
}

export default function CatalogSidebar({
  dict,
  chips,
  counts,
  total,
  collections,
  activeCat,
  activeCol,
  onCat,
  onCol,
}: CatalogFilterProps) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pe-1">
        <nav aria-label={dict.catalog.eyebrow}>
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
            {dict.catalog.eyebrow}
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <SidebarRow on={activeCat === ALL} label={dict.catalog.all} count={total} onClick={() => onCat(ALL)} />
            </li>
            {chips.map((c) => (
              <li key={c}>
                <SidebarRow
                  on={activeCat === c}
                  label={catCatLabel(dict, c)}
                  count={counts.get(c) ?? 0}
                  onClick={() => onCat(activeCat === c ? ALL : c)}
                />
              </li>
            ))}
          </ul>
        </nav>

        {collections.length > 0 && (
          <details className="group mt-6" open>
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)] transition-colors hover:text-ink">
                {dict.catalog.collections}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-3 w-3 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <ul className="mt-2 flex flex-col gap-0.5">
              {collections.map(([name, n]) => (
                <li key={name}>
                  <SidebarRow
                    on={activeCol === name}
                    label={name}
                    count={n}
                    onClick={() => onCol(activeCol === name ? ALL : name)}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </aside>
  );
}
