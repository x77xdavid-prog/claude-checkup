"use client";

import { useMemo, useState } from "react";
import CopyButton from "./CopyButton";

// 스킬 카탈로그 검색 + 설치 명령 복사. 데이터는 서버에서 받아옴(정규화된 SkillItem[]).
// 스키마 유연성: 서버가 어떤 원본이든 이 형태로 정규화해서 넘긴다.
export interface SkillItem {
  name: string;
  description: string;
  install: string; // 설치 명령 (없으면 빈 문자열)
  category?: string;
  tags?: string[];
}

export default function CatalogBrowser({ items }: { items: SkillItem[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((s) => {
      const hay = [s.name, s.description, s.category ?? "", ...(s.tags ?? [])].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [q, items]);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 mb-6 border-b border-[var(--line-strong)] bg-[var(--paper)]/90 px-5 py-4 backdrop-blur">
        <label className="sr-only" htmlFor="catalog-search">
          스킬 검색
        </label>
        <input
          id="catalog-search"
          type="search"
          placeholder="스킬 검색 (이름·설명·태그)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-4 py-3 font-mono text-ink placeholder:text-[var(--ink-faint)]"
        />
        <p className="mt-2 font-mono text-xs text-[var(--ink-faint)]">
          {filtered.length} / {items.length} 개
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-[var(--ink-soft)]">검색 결과가 없습니다.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => (
            <li key={s.name} className="paper-card flex flex-col rounded-lg px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-lg font-semibold text-ink">{s.name}</h3>
                {s.category && (
                  <span className="shrink-0 rounded-full bg-[var(--paper-2)] px-2 py-0.5 font-mono text-xs text-[var(--ink-soft)]">
                    {s.category}
                  </span>
                )}
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--ink-soft)]">{s.description}</p>
              {s.install && (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
                  <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{s.install}</code>
                  <CopyButton text={s.install} label="복사" className="shrink-0 !px-2 !py-1 !text-xs" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
