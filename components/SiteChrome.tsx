import Link from "next/link";

// 공통 헤더 + 푸터. 서버 컴포넌트. 페이지들이 <SiteChrome>{children}</SiteChrome>로 감쌈.
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--line-strong)] bg-[var(--paper)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="group inline-flex items-baseline gap-2">
          <span className="font-serif text-lg font-bold text-ink">claude</span>
          <span className="font-mono text-xs text-[var(--accent)]">checkup</span>
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-4 text-sm">
          <Link href="/catalog" className="link-ink">
            카탈로그
          </Link>
          <Link href="/pricing" className="link-ink">
            프라이싱
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--line-strong)] bg-[var(--paper-2)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-sm text-[var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono">claude-checkup</p>
        <p>수집: 개수와 설정 여부만. 파일 내용·이름은 전송하지 않습니다.</p>
      </div>
    </footer>
  );
}
