"use client";

// 테마 토글(light ↔ dark) — 2-state. 기본은 시스템 선호([locale]/layout.tsx <head>의
// FOUC 스크립트가 첫 페인트 전 <html data-theme>를 세팅). 클릭하면 반대 테마로 전환하고
// localStorage("theme")에 저장한다(다음 방문부터 저장값이 시스템 선호보다 우선).
//
// hydration mismatch·깜빡임 없음: 컴포넌트가 상태를 갖지 않는다. 달/해 SVG를 둘 다
// 렌더하고 globals.css가 :root[data-theme]에 따라 하나만 표시한다(.theme-icon-*) —
// 서버·클라이언트 HTML이 항상 동일하고, 아이콘은 CSS가 첫 페인트부터 올바르게 고른다.
// 현재 테마는 클릭 시점에 documentElement에서 읽는다.
// 아이콘 교체는 display 스왑(트랜지션 없음)이라 prefers-reduced-motion과 무관하게 안전.
//
// 마운트: SiteChrome 헤더(데스크톱 전용) + MobileNav 시트(테마 행, 44px 터치 타겟).
// 크기·표시 여부는 호출부가 className으로 지정한다(display 클래스 포함 필수).

export default function ThemeToggle({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 프라이빗 모드 등 저장 실패는 무시 — 세션 내 전환은 그대로 동작
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`items-center justify-center rounded-md text-ink transition-colors hover:text-[var(--accent-ink)] ${className}`}
    >
      {/* 달 — 라이트 모드에서 표시("다크로 전환" 의미) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-moon h-5 w-5"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      {/* 해 — 다크 모드에서 표시("라이트로 전환" 의미) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-sun h-5 w-5"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
