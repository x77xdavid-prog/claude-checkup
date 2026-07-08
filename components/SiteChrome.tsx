import Link from "next/link";
import LangSwitcher from "./LangSwitcher";
import type { Dict, Locale } from "@/lib/i18n";

// 공통 헤더 + 푸터. 서버 컴포넌트. 페이지들이 <SiteChrome locale dict>{children}</SiteChrome>로 감쌈.
// 내부 링크는 /{locale}/... 접두. 언어 스위처는 헤더에 위치.
export default function SiteChrome({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header locale={locale} dict={dict} />
      <main className="flex-1">{children}</main>
      <Footer dict={dict} />
    </div>
  );
}

function Header({ locale, dict }: { locale: Locale; dict: Dict }) {
  const home = `/${locale}`;
  return (
    <header className="border-b border-[var(--line-strong)] bg-[var(--paper)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href={home} className="group inline-flex items-baseline gap-2">
          <span className="font-serif text-lg font-bold text-ink">claude</span>
          <span className="font-mono text-xs text-[var(--accent)]">{dict.nav.brandCheckup}</span>
        </Link>
        <nav aria-label={dict.nav.menuLabel} className="flex items-center gap-4 text-sm">
          <Link href={`${home}/catalog`} className="link-ink">
            {dict.nav.catalog}
          </Link>
          <Link href={`${home}/pricing`} className="link-ink">
            {dict.nav.pricing}
          </Link>
          <LangSwitcher locale={locale} label={dict.nav.langLabel} />
        </nav>
      </div>
    </header>
  );
}

function Footer({ dict }: { dict: Dict }) {
  return (
    <footer className="mt-20 border-t border-[var(--line-strong)] bg-[var(--paper-2)]">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col gap-2 text-sm text-[var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono">{dict.footer.brand}</p>
          <p>{dict.footer.trust}</p>
        </div>
        <p className="mt-2 text-xs text-[var(--ink-faint)]">{dict.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
