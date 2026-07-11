"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { TIER, isTierKind, injectN, type SkillItem } from "./catalog-shared";

// ① 검색 히어로(시안 C) — 페이지의 CTA로 승격된 큰 검색바 + 클라이언트 자동완성.
// - API 호출 없음: 부모(CatalogBrowser)가 기존 itemMatches(L1~L3) 로직으로 계산한 results를
//   그대로 받아 상위 5개만 150ms 디바운스로 보여준다(search-log 전송은 부모 기존 로직 유지).
// - ARIA combobox 패턴(CommandPalette 전례): aria-expanded·aria-controls·aria-activedescendant
//   + listbox/option, 키보드 ↑↓/Enter/Esc, 바깥 클릭 닫기.
// - ⌘K 키캡 배지는 데스크톱 전용 힌트(전역 단축키는 CommandPalette가 계속 처리).

const DEBOUNCE_MS = 150;
const MAX_SUGGEST = 5;
const LISTBOX_ID = "catalog-suggest-listbox";

export default function CatalogSearchHero({
  value,
  onChange,
  results,
  installCounts,
  dict,
  onSubmit,
}: {
  value: string;
  onChange: (q: string) => void;
  results: SkillItem[]; // 현재 검색어·필터가 반영된 전체 결과(부모 계산 — 자동완성과 본문 리스트 일치)
  installCounts: Map<string, number> | null; // funnel-stats topInstalls(실패 시 null — 표시만 생략)
  dict: Dict;
  onSubmit: () => void; // 검색 확정(Enter·전체 보기) — 부모가 search-log 전송
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1); // -1=없음, 0..n-1=제안, n=전체 보기 행
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressRef = useRef(false); // 제안 선택 직후 드롭다운 재오픈 방지
  const resultsRef = useRef(results);

  // 최신 results를 ref로 유지 — 디바운스 콜백이 항상 현재 결과를 읽는다.
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  // 150ms 디바운스로 제안 갱신. 입력이 포커스 중일 때만 연다
  // (마운트 직후 ?q= 시딩이나 프로그램적 setQ로 갑자기 열리는 것 방지).
  useEffect(() => {
    if (!value.trim()) {
      setOpen(false);
      setSuggestions([]);
      setTotal(0);
      setActiveIdx(-1);
      return;
    }
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      const r = resultsRef.current;
      setSuggestions(r.slice(0, MAX_SUGGEST));
      setTotal(r.length);
      setActiveIdx(-1);
      if (document.activeElement === inputRef.current) setOpen(true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  // 바깥 클릭 닫기 — 열려 있을 때만 리스너 부착.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // 제안 선택 — 검색어를 스킬 이름으로 확정(본문 리스트가 그 스킬을 보여줌).
  function pick(s: SkillItem) {
    suppressRef.current = true;
    onChange(s.name);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  // 검색 확정(전체 보기 행·Enter) — 드롭다운만 닫는다(본문 리스트는 이미 필터링돼 있음).
  function commitAll() {
    setOpen(false);
    setActiveIdx(-1);
    onSubmit();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIdx >= 0 && activeIdx < suggestions.length) pick(suggestions[activeIdx]);
      else commitAll();
      return;
    }
    if (!open) return;
    const rows = suggestions.length + 1; // 마지막 행 = 전체 결과 보기
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % rows);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + rows) % rows);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="sr-only" htmlFor="catalog-search">
        {dict.catalog.searchLabel}
      </label>
      <div className="relative">
        {/* 돋보기 — 인라인 SVG(stroke 2) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--ink-soft)]"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          ref={inputRef}
          id="catalog-search"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? LISTBOX_ID : undefined}
          aria-activedescendant={open && activeIdx >= 0 ? `catalog-suggest-${activeIdx}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={dict.catalog.searchPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-[52px] w-full rounded-md border-2 border-[var(--ink)] bg-white py-3 pe-4 ps-12 font-mono text-ink shadow-[4px_4px_0_var(--line-strong)] placeholder:text-[var(--ink-faint)] md:pe-16"
        />
        {/* ⌘K 키캡 힌트 — 데스크톱 전용(전역 단축키는 CommandPalette가 처리) */}
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-[var(--line-strong)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-xs text-[var(--ink-soft)] md:flex"
        >
          ⌘K
        </kbd>
      </div>

      {open && (
        <ul
          id={LISTBOX_ID}
          role="listbox"
          aria-label={dict.catalog.searchLabel}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-md border-2 border-[var(--ink)] bg-white shadow-[4px_4px_0_var(--line-strong)]"
        >
          {suggestions.map((s, i) => {
            const tier = isTierKind(s.install2?.kind) ? s.install2!.kind : null;
            const count = installCounts?.get(s.name);
            return (
              <li key={s.name} role="presentation">
                <button
                  id={`catalog-suggest-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => pick(s)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIdx ? "bg-[var(--paper-2)]" : ""
                  }`}
                >
                  <span className="block min-w-0 flex-1 truncate">
                    <span className="font-mono text-sm font-bold text-ink">{s.name}</span>
                    <span className="ms-2 text-xs text-[var(--ink-soft)]">{s.description}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
                    {tier && (
                      <span className={TIER[tier].glyphCls} title={dict.catalog[TIER[tier].labelKey]}>
                        <span aria-hidden>{TIER[tier].glyph}</span>
                        <span className="sr-only">{dict.catalog[TIER[tier].labelKey]}</span>
                      </span>
                    )}
                    {typeof count === "number" && (
                      <span className="text-[var(--ink-soft)]">↓ {count}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {/* 마지막 행 — 전체 결과 N개 보기(N은 계산값) */}
          <li role="presentation" className={suggestions.length > 0 ? "border-t border-[var(--line)]" : undefined}>
            <button
              id={`catalog-suggest-${suggestions.length}`}
              type="button"
              role="option"
              aria-selected={activeIdx === suggestions.length}
              onMouseEnter={() => setActiveIdx(suggestions.length)}
              onClick={commitAll}
              className={`w-full px-4 py-2.5 text-left font-mono text-xs text-[var(--accent-ink)] transition-colors ${
                activeIdx === suggestions.length ? "bg-[var(--paper-2)]" : ""
              }`}
            >
              {injectN(dict.catalog.viewAllResults, total)} →
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
