"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LangSwitcher from "./LangSwitcher";
import ThemeToggle from "./ThemeToggle";
import type { Dict, Locale } from "@/lib/i18n";

// 모바일 전용 헤더 내비(md 미만) — 햄버거 버튼 + 상단 종이 시트.
// SiteChrome(서버 컴포넌트)의 Header에 데스크톱 nav와 형제로 마운트된다.
// 데스크톱(≥md)에서는 md:hidden으로 렌더 자체가 없다 — 기존 경험 무변경.
//
// 검색 접근: CommandPalette 트리거 배지는 데스크톱 전용이므로(해당 컴포넌트 주석
// "모바일은 카탈로그 페이지의 검색창이 그 역할을 대신함") 시트에는 카탈로그 검색으로
// 가는 진입 항목을 둔다(dict.cmdk.goCatalog 재사용 — 신규 키 0개).
// ⌘K/Ctrl+K는 CommandPalette가 전역 keydown으로 계속 처리한다(팔레트는 숨김 nav
// "밖"에 마운트되어 모바일 폭에서도 동작). 시트가 열린 채 그 키가 눌리면 시트를
// 닫아 팔레트에 자리를 내준다(z-50 동률 오버레이 겹침 방지).

const NAV_ITEMS = [
  { key: "catalog", path: "/catalog" },
  { key: "guide", path: "/guide" },
  { key: "prompts", path: "/prompts" },
  { key: "pricing", path: "/pricing" },
] as const;

const SHEET_ID = "mobile-nav-sheet";

// 시트 등장 모션 — globals.css의 전역 prefers-reduced-motion 규칙(animation: none
// !important)에 더해, 적용 클래스도 motion-safe: 변형이라 이중으로 조건부다.
const SHEET_KEYFRAMES =
  "@keyframes ccu-mnav-sheet{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}";

export default function MobileNav({ locale, dict }: { locale: Locale; dict: Dict }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false); // 최초 마운트에 햄버거로 포커스 뺏는 것 방지용

  // 경로가 바뀌면 닫는다 — 링크 클릭은 onClick으로도 닫지만, 시트 안 LangSwitcher의
  // router.push처럼 onClick을 못 붙이는 내비게이션까지 여기서 공통 처리.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 열림: 첫 항목(카탈로그 링크)으로 포커스 이동. 닫힘: 햄버거로 복귀.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  // 열린 동안 body 스크롤 잠금 — cleanup이 닫힘·언마운트 양쪽에서 원복을 보장.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc 닫기 + Tab 포커스 트랩 + ⌘K 양보. 열려 있을 때만 리스너 부착.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        setOpen(false); // CommandPalette가 같은 이벤트로 열린다 — 시트는 비켜준다
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select'
      );
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

  // 뷰포트가 md(768px) 이상으로 커지면 닫는다 — 시트는 md:hidden으로 사라지는데
  // 스크롤 잠금·open 상태만 남는 고아 상태 방지(회전·창 리사이즈).
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
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

  const home = `/${locale}`;

  return (
    <>
      {/* 햄버거 토글 — 44×44 터치 타겟. aria-controls는 시트가 DOM에 있을 때만
          참조(닫힌 상태에 존재하지 않는 id를 가리키는 ARIA 위반 방지). */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.nav.menuLabel}
        aria-expanded={open}
        aria-controls={open ? SHEET_ID : undefined}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors hover:text-[var(--accent-ink)] md:hidden"
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
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 오버레이 — 닫힌 상태에선 DOM 자체를 렌더하지 않음(CommandPalette와 동일 패턴).
          바깥(backdrop) 클릭 = 닫기, 시트 내부 클릭은 stopPropagation. */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur md:hidden"
          onClick={() => setOpen(false)}
        >
          <style>{SHEET_KEYFRAMES}</style>
          <div
            ref={panelRef}
            id={SHEET_ID}
            role="dialog"
            aria-modal="true"
            aria-label={dict.nav.menuLabel}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-0 max-h-dvh overflow-y-auto border-b-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] pb-3 shadow-[0_3px_0_var(--line-strong)] motion-safe:animate-[ccu-mnav-sheet_180ms_ease-out]"
          >
            {/* 상단 행 — 시트 라벨 + 닫기 버튼(같은 토글 의미: aria-expanded=true) */}
            <div className="flex items-center justify-between border-b border-[var(--line)] py-1 pe-2 ps-5">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                {dict.nav.menuLabel}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.nav.menuLabel}
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

            {/* 메뉴 항목 — 데스크톱 nav와 동일 순서, 항목별 하단 괘선, 행 전체가 44px+ 터치 타겟 */}
            <ul className="px-5">
              {NAV_ITEMS.map((item) => (
                <li key={item.key} className="border-b border-[var(--line)]">
                  <Link
                    href={`${home}${item.path}`}
                    onClick={() => setOpen(false)}
                    className="link-ink flex min-h-11 items-center py-2 text-base"
                  >
                    {dict.nav[item.key]}
                  </Link>
                </li>
              ))}
              {/* 검색 진입 — 모바일 검색은 카탈로그 페이지 검색창이 담당(cmdk.goCatalog 재사용) */}
              <li className="border-b border-[var(--line)]">
                <Link
                  href={`${home}/catalog`}
                  onClick={() => setOpen(false)}
                  className="link-ink flex min-h-11 items-center gap-2 py-2 text-base"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="h-4 w-4 text-[var(--ink-soft)]"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </svg>
                  {dict.cmdk.goCatalog}
                </Link>
              </li>
            </ul>

            {/* 언어 선택 — LangSwitcher 재사용. 보이는 라벨은 장식(select가 자체
                aria-label 보유 → aria-hidden으로 중복 낭독 방지). 래퍼의 자식 셀렉터로
                select 터치 타겟만 44px로 키운다(데스크톱 인스턴스는 별개라 무영향). */}
            <div className="flex min-h-11 items-center justify-between px-5 pt-3">
              <span
                aria-hidden="true"
                className="font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]"
              >
                {dict.nav.langLabel}
              </span>
              <div className="[&_select]:min-h-11 [&_select]:px-3 [&_select]:text-sm">
                <LangSwitcher locale={locale} label={dict.nav.langLabel} />
              </div>
            </div>

            {/* 테마 전환 — 언어 행과 동일 구성(장식 라벨 + 자체 aria-label 보유 컨트롤).
                버튼은 44×44 터치 타겟. 포커스 트랩의 button 셀렉터에 자동 포함된다. */}
            <div className="flex min-h-11 items-center justify-between px-5 pt-2">
              <span
                aria-hidden="true"
                className="font-mono text-xs uppercase tracking-wider text-[var(--ink-faint)]"
              >
                {dict.nav.themeToggle}
              </span>
              <ThemeToggle label={dict.nav.themeToggle} className="inline-flex h-11 w-11" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
