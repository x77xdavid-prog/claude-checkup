import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import CatalogBrowser from "@/components/CatalogBrowser";
import { loadCatalogSync } from "@/lib/catalog";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { localizedUsecases } from "@/lib/i18n-helpers";
import { alternatesFor } from "../layout";

// 스킬 카탈로그 — 서버 컴포넌트. public/catalog.json을 빌드 시 동기로 읽어
// CatalogBrowser에 initialItems로 전달 → 구글이 JS 없이 569종 이름·설명을 HTML에서 본다(SEO 핵심).
// 로케일별 정적 프리렌더(generateStaticParams는 [locale] 레이아웃이 담당).
// description·설치 명령은 원문 유지 — UI 크롬만 번역.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  // 메타의 스킬 개수는 실제 카탈로그 수(로컬+외부)로 동적 치환 — locales의 하드코딩 수치가
  // 실측과 어긋나지 않게. 모든 로케일이 ASCII 숫자 1개를 쓰므로 첫 3+자리 숫자런을 교체.
  const count = loadCatalogSync()?.length ?? 0;
  const withCount = (s: string) => (count > 0 ? s.replace(/\d[\d,]{2,}/, String(count)) : s);
  const title = withCount(dict.meta.catalogTitle);
  const description = withCount(dict.meta.catalogDesc);
  return {
    title,
    description,
    alternates: alternatesFor(loc, "/catalog"),
    openGraph: { title, description },
  };
}

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  const items = loadCatalogSync();
  const usecases = localizedUsecases(dict);

  // JSON-LD ItemList — 상위 50개 스킬 name만(전체 넣으면 비대). 검색엔진 리치 결과용.
  const ldItems = (items ?? []).slice(0, 50).map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.name,
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: dict.meta.catalogTitle,
    numberOfItems: items?.length ?? 0,
    itemListElement: ldItems,
  };

  return (
    <SiteChrome locale={loc} dict={dict}>
      {ldItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{dict.catalog.eyebrow}</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">
          {dict.catalog.title1} <span className="text-[var(--accent)]">{dict.catalog.titleAccent}</span>
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[var(--ink-soft)]">{dict.catalog.subtitle}</p>

        {/* 정직 고지 — 스킬 설명은 원문 유지 */}
        <p className="mt-3 font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.origNotice}</p>

        {/* 설치 장벽 해소 — 큐레이션 마켓플레이스 원라이너 */}
        <div className="mt-6 rounded-xl border-2 border-[var(--accent)] bg-[var(--paper)] px-5 py-4">
          <p className="font-serif text-lg font-bold text-ink">{dict.catalog.mpTitle}</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {dict.catalog.mpBodyPre}{" "}
            <strong className="text-ink">{dict.catalog.mpBodyStrong}</strong> {dict.catalog.mpBodyPost}
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-[#2a2a2a] px-4 py-3 font-mono text-sm text-[#f4f4f4]">
            /plugin marketplace add x77xdavid-prog/checkup-skills
          </code>
          <p className="mt-2 font-mono text-xs text-[var(--ink-faint)]">
            {dict.catalog.mpListPre}{" "}
            <a
              className="underline"
              href="https://github.com/x77xdavid-prog/checkup-skills"
              rel="noopener noreferrer"
              target="_blank"
            >
              {dict.catalog.mpGithub}
            </a>
          </p>
        </div>

        <div className="mt-10">
          {items === null ? (
            <EmptyState locale={loc} dict={dict} />
          ) : items.length === 0 ? (
            <p className="paper-card rounded-lg px-6 py-10 text-center text-[var(--ink-soft)]">
              {dict.catalog.noItems}
            </p>
          ) : (
            <CatalogBrowser initialItems={items} dict={dict} usecases={usecases} />
          )}
        </div>

        {/* SEO — 롱테일 질의가 이 페이지에 닿게. 실존 스킬만 나열. */}
        {items && items.length > 0 && (
          <section aria-labelledby="usecases-heading" className="mt-16 border-t border-[var(--line-strong)] pt-10">
            <h2 id="usecases-heading" className="font-serif text-3xl font-black text-ink">
              {dict.catalog.ucHeading}
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-[var(--ink-soft)]">{dict.catalog.ucSub}</p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {usecases.map((uc) => {
                const known = new Set(items.map((s) => s.name));
                const live = uc.skillNames.filter((n) => known.has(n));
                if (live.length === 0) return null;
                return (
                  <li key={uc.id} className="paper-card rounded-lg px-5 py-5">
                    <h3 className="font-serif text-xl font-semibold text-ink">{uc.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{uc.pitch}</p>
                    <p className="mt-3 font-mono text-xs text-[var(--ink-faint)]">{live.join(" · ")}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>
    </SiteChrome>
  );
}

// catalog.json 미생성 안내
function EmptyState({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDict> }) {
  return (
    <div className="paper-card rounded-xl px-6 py-12 text-center">
      <div className="stamp stamp--low mx-auto mb-5 h-16 w-16 text-2xl" aria-hidden>
        …
      </div>
      <h2 className="font-serif text-2xl text-ink">{dict.catalog.emptyTitle}</h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-[var(--ink-soft)]">{dict.catalog.emptyBody}</p>
      <Link href={`/${locale}`} className="btn-ghost mt-6 inline-block rounded-md px-5 py-2.5 font-medium">
        {dict.catalog.emptyHome}
      </Link>
    </div>
  );
}
