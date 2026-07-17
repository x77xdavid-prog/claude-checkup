"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";

// ⌘K/Ctrl+K 커맨드 팔레트 — 사이트 어디서나 열어 카탈로그 검색 또는 주요 페이지로 즉시 이동.
// 신규 의존성 0(플레인 keydown 리스너 + useState). 트리거 배지(데스크톱 전용)와 오버레이를
// 이 컴포넌트 하나가 함께 렌더한다 — SiteChrome은 서버 컴포넌트라 onClick을 직접 못 붙이므로
// "마운트 위치 = 헤더 노출 위치"로 해결(SiteChrome은 <CommandPalette>를 헤더 nav에 배치만 함).

type ShortcutId = "catalog" | "start" | "prompts" | "guide" | "rubric";

interface Shortcut {
  id: ShortcutId;
  labelKey: keyof Dict["cmdk"];
  path: string; // locale 접두 전 상대 경로
}

// 정적 바로가기 5개(스펙 고정) — catalog만 입력값과 연동, 나머지는 고정 경로.
const SHORTCUTS: Shortcut[] = [
  { id: "catalog", labelKey: "goCatalog", path: "/catalog" },
  { id: "start", labelKey: "goStart", path: "/start" },
  { id: "prompts", labelKey: "goPrompts", path: "/prompts" },
  { id: "guide", labelKey: "goGuide", path: "/guide" },
  { id: "rubric", labelKey: "goRubric", path: "/rubric" },
];

export default function CommandPalette({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function go(path: string) {
    router.push(`/${locale}${path}`);
    setOpen(false);
  }

  // 항목 클릭 — catalog 항목만 현재 입력값을 반영, 나머지 4개는 고정 경로로 이동.
  function pick(s: Shortcut) {
    const trimmed = query.trim();
    if (s.id === "catalog" && trimmed) go(`/catalog?q=${encodeURIComponent(trimmed)}`);
    else go(s.path);
  }

  // Enter 키 — 입력값이 있으면 항목 선택과 무관하게 카탈로그 검색으로, 없으면 화살표로 고른 항목으로.
  function commitEnter() {
    const trimmed = query.trim();
    if (trimmed) go(`/catalog?q=${encodeURIComponent(trimmed)}`);
    else go(SHORTCUTS[activeIndex].path);
  }

  // 단일 keydown 리스너(컴포넌트 생애주기 동안 1개). Cmd/Ctrl+K는 항상 감지해 토글하고,
  // 나머지 키(Esc·화살표·Enter)는 열려 있을 때만 처리. "/" 단독 키는 건드리지 않는다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % SHORTCUTS.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + SHORTCUTS.length) % SHORTCUTS.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        commitEnter();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, query, activeIndex, locale, router]);

  // 열림/닫힘 전환 — 스크롤 잠금, 입력창 autofocus, 포커스 복원, 검색 상태 초기화.
  // window/document 접근은 전부 이 useEffect 안(SSR 안전).
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      inputRef.current?.focus();
    } else {
      document.body.style.overflow = "";
      triggerRef.current?.focus();
      triggerRef.current = null;
      setQuery("");
      setActiveIndex(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 트리거 배지 — 데스크톱 전용(모바일은 카탈로그 페이지의 검색창이 그 역할을 대신함) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.cmdk.hint}
        className="hidden min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper-2)] px-2 py-1 font-mono text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] md:inline-flex"
      >
        <span aria-hidden>⌘</span>K
      </button>

      {/* 오버레이 — 닫힌 상태에선 DOM 자체를 렌더하지 않음(성능) */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.cmdk.hint}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-lg border-[1.5px] border-[var(--line-strong)] bg-[var(--paper-2)] shadow-[6px_6px_0_var(--line-strong)]"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.cmdk.placeholder}
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-listbox"
              aria-activedescendant={`cmdk-option-${activeIndex}`}
              autoComplete="off"
              className="w-full rounded-t-lg border-b border-[var(--line-strong)] bg-transparent px-4 py-3 font-mono text-ink placeholder:text-[var(--ink-faint)] focus:outline-none"
            />
            <p className="px-4 pt-3 font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
              {dict.cmdk.hint}
            </p>
            <ul id="cmdk-listbox" role="listbox" aria-label={dict.cmdk.hint} className="flex flex-col gap-0.5 p-2">
              {SHORTCUTS.map((s, i) => (
                <li key={s.id} role="presentation">
                  <button
                    id={`cmdk-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(s)}
                    className={`w-full rounded-md px-3 py-2 text-left font-mono text-sm transition-colors ${
                      i === activeIndex ? "bg-[var(--accent)] text-white" : "text-ink hover:bg-[var(--paper)]"
                    }`}
                  >
                    {dict.cmdk[s.labelKey]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
