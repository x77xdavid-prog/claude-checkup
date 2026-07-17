"use client";

import { useEffect, useRef, useState } from "react";
import { catCatLabel, catColLabel } from "@/lib/i18n-helpers";
import { ALL, type CatalogFilterProps } from "./catalog-shared";

// ③ 모바일(lg 미만) 필터 시트 — MobileNav의 시트 패턴 이식:
// 포커스 트랩·Esc·backdrop 클릭 닫기·body 스크롤 잠금·reduced-motion 존중·44px 터치 타겟·
// 닫힘 시 트리거로 포커스 복귀·뷰포트가 lg 이상으로 커지면 자동 닫기(고아 상태 방지).
// 선택 즉시 필터 반영(적용 버튼 없음) — 시트를 열어둔 채 카테고리+컬렉션을 함께 고를 수 있다.

const SHEET_ID = "catalog-filter-sheet";

// 시트 등장 모션 — globals.css의 전역 prefers-reduced-motion 규칙(animation: none !important)에
// 더해, 적용 클래스도 motion-safe: 변형이라 이중으로 조건부다(MobileNav와 동일).
const SHEET_KEYFRAMES =
  "@keyframes ccu-fsheet{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}";

function SheetRow({
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
      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-base transition-colors ${
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

export default function FilterSheet({
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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false); // 최초 마운트에 트리거로 포커스 뺏는 것 방지용

  // 활성 필터 수 배지 — 카테고리·컬렉션 각각 최대 1개(전부 계산값).
  const activeCount = (activeCat !== ALL ? 1 : 0) + (activeCol !== ALL ? 1 : 0);

  // 열림: 첫 버튼(닫기)으로 포커스 이동. 닫힘: 트리거로 복귀.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  // 열린 동안 body 스크롤 잠금 — cleanup이 닫힘·언마운트 양쪽에서 원복 보장.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc 닫기 + Tab 포커스 트랩. 열려 있을 때만 리스너 부착(MobileNav 패턴).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && panel.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // 뷰포트가 lg(1024px) 이상으로 커지면 닫는다 — 시트는 lg:hidden으로 사라지는데
  // 스크롤 잠금·open 상태만 남는 고아 상태 방지(회전·창 리사이즈).
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) {
      setOpen(false);
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  return (
    <>
      {/* 트리거 — 44px 터치 타겟 + 활성 필터 수 배지. lg 이상은 사이드바가 대체(렌더 안 함). */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={open ? SHEET_ID : undefined}
        className="btn-ghost inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-mono text-xs lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
        </svg>
        {dict.catalog.filters}
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-ink)] px-1 font-mono text-xs text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* 오버레이 — 닫힌 상태에선 DOM 자체를 렌더하지 않음(MobileNav·CommandPalette와 동일 패턴). */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur lg:hidden" onClick={() => setOpen(false)}>
          <style>{SHEET_KEYFRAMES}</style>
          <div
            ref={panelRef}
            id={SHEET_ID}
            role="dialog"
            aria-modal="true"
            aria-label={dict.catalog.filters}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-0 max-h-dvh overflow-y-auto border-b-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] pb-4 shadow-[0_3px_0_var(--line-strong)] motion-safe:animate-[ccu-fsheet_180ms_ease-out]"
          >
            {/* 상단 행 — 시트 라벨 + 닫기 버튼 */}
            <div className="flex items-center justify-between border-b border-[var(--line)] py-1 pe-2 ps-5">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                {dict.catalog.filters}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.catalog.filters}
                aria-expanded="true"
                aria-controls={SHEET_ID}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors hover:text-[var(--accent-ink)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            {/* 카테고리 — 선택 즉시 반영 */}
            <p className="px-5 pt-3 font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
              {dict.catalog.eyebrow}
            </p>
            <ul className="px-3 pt-1">
              <li>
                <SheetRow on={activeCat === ALL} label={dict.catalog.all} count={total} onClick={() => onCat(ALL)} />
              </li>
              {chips.map((c) => (
                <li key={c}>
                  <SheetRow
                    on={activeCat === c}
                    label={catCatLabel(dict, c)}
                    count={counts.get(c) ?? 0}
                    onClick={() => onCat(activeCat === c ? ALL : c)}
                  />
                </li>
              ))}
            </ul>

            {/* 컬렉션 — 카테고리와 AND(기존 activeCol 필터 그대로) */}
            {collections.length > 0 && (
              <>
                <p className="px-5 pt-4 font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                  {dict.catalog.collections}
                </p>
                <ul className="px-3 pt-1">
                  {collections.map(([name, n]) => (
                    <li key={name}>
                      <SheetRow
                        on={activeCol === name}
                        label={catColLabel(dict, name)}
                        count={n}
                        onClick={() => onCol(activeCol === name ? ALL : name)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
