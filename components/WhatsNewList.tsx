import Link from "next/link";
import whatsNew from "@/public/whats-new.json";
import type { Dict, Locale } from "@/lib/i18n";
import { catCatLabel } from "@/lib/i18n-helpers";

// 홈 "새로 추가된 스킬" 리스트 — 서버 컴포넌트.
// public/whats-new.json(RSS와 동일 소스)을 빌드 시 정적 import → addedAt 내림차순 최신 8개.
// 각 행은 카탈로그 검색 딥링크(/catalog?q=<이름>)로 연결(카탈로그 페이지가 ?q= 시딩 지원).

const MAX_ITEMS = 8;

// 날짜는 로케일 무관 YYYY-MM-DD 고정(서버/클라이언트·타임존 불일치로 인한 hydration 흔들림 방지).
function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function WhatsNewList({ locale, dict }: { locale: Locale; dict: Dict }) {
  const items = [...whatsNew.items]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return null;

  return (
    <div className="mt-8 max-w-2xl">
      <ul className="paper-card divide-y divide-[var(--line-strong)] rounded-xl">
        {items.map((item) => (
          <li key={item.name}>
            <Link
              href={`/${locale}/catalog?q=${encodeURIComponent(item.name)}`}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--paper-2)]"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink group-hover:text-[var(--accent)]">
                {item.name}
              </span>
              {item.category && (
                <span className="hidden shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--paper-2)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--ink-soft)] sm:inline-block">
                  {catCatLabel(dict, item.category)}
                </span>
              )}
              <time dateTime={item.addedAt} className="shrink-0 font-mono text-xs text-[var(--ink-faint)]">
                {formatDate(item.addedAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${locale}/catalog`} className="btn-ghost rounded-md px-5 py-2.5 font-medium">
          {dict.whatsNew.viewAll}
        </Link>
        <a href="/whats-new.xml" className="font-mono text-xs text-[var(--ink-faint)] underline underline-offset-2 hover:text-[var(--accent)]">
          {dict.whatsNew.rss}
        </a>
      </div>
    </div>
  );
}
