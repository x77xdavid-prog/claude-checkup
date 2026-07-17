import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import ScannerTabs from "@/components/ScannerTabs";
import SubscribeForm from "@/components/SubscribeForm";
import DemoReport from "@/components/DemoReport";
import WhatsNewList from "@/components/WhatsNewList";
import { getDict, HREFLANG, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "./layout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: dict.meta.homeTitle,
    description: dict.meta.homeDesc,
    alternates: alternatesFor(loc, ""),
  };
}

// 랜딩. 히어로 + 스캐너 실행 안내 + 신뢰 문구 + 영역 미리보기 + 구독 + 프라이싱 CTA.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  // WebSite JSON-LD — 사이트 정체성·검색 액션 힌트.
  const webSiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "claude-checkup",
    url: `${SITE_URL}/${loc}`,
    description: dict.meta.siteDesc,
    inLanguage: HREFLANG[loc],
  };

  return (
    <SiteChrome locale={loc} dict={dict}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteLd) }}
      />
      {/* ① 히어로 */}
      <section className="mx-auto max-w-5xl px-5 pt-14 pb-8 sm:pt-20">
        <p className="mb-4 inline-block rounded-full border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-1 font-mono text-xs text-[var(--ink-soft)]">
          {dict.hero.badge}
        </p>
        <h1 className="font-serif text-[2.75rem] font-black leading-[0.98] tracking-tight text-ink sm:text-7xl">
          {dict.hero.title1}
          <br />
          <span className="text-[var(--accent)]">{dict.hero.titleAccent}</span>
          {dict.hero.title2 ? ` ${dict.hero.title2}` : ""}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">{dict.hero.subtitle}</p>
        <p className="mt-4 max-w-xl border-l-2 border-[var(--accent)] pl-4 text-base font-medium leading-relaxed text-ink">
          {dict.hero.mission}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={`/${loc}/start`} className="btn-accent rounded-md px-6 py-3 font-semibold">
            {dict.hero.ctaStart}
          </Link>
          <a href="#demo-report" className="btn-ghost rounded-md px-6 py-3 font-medium">
            {dict.hero.ctaDemo}
          </a>
          <a href="#my-score" className="btn-ghost rounded-md px-6 py-3 font-medium">
            {dict.hero.ctaScore}
          </a>
        </div>
      </section>

      {/* ② 예시 진단서 — 결과물의 가치를 스캔 전에 먼저 */}
      <section id="demo-report" className="mx-auto max-w-5xl px-5 py-12 scroll-mt-20">
        <DemoReport dict={dict} />
      </section>

      {/* ③ 내 점수 확인하기 — 스캐너 실행 안내 */}
      <section id="my-score" className="mx-auto max-w-5xl px-5 py-12 scroll-mt-20">
        <h2 className="font-serif text-3xl font-black text-ink sm:text-4xl">
          {dict.score.sectionLabel} <span className="text-[var(--accent)]">{dict.score.sectionAccent}</span>
          {dict.score.sectionAfter ? ` ${dict.score.sectionAfter}` : ""}
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-[var(--ink-soft)]">{dict.score.sectionDesc}</p>

        <div className="mt-8 max-w-2xl">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-mono text-sm font-bold text-ink">{dict.scanner.runHeading}</h3>
            <span className="font-mono text-xs text-[var(--ink-faint)]">{dict.scanner.runNote}</span>
          </div>
          <ScannerTabs dict={dict} />
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">{dict.scanner.howto}</p>

          {/* 신뢰 문구 — 셀링포인트 (개인정보) */}
          <div className="mt-4 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--paper-2)] px-4 py-3">
            <p className="text-sm leading-relaxed text-ink">
              <strong className="font-semibold">{dict.scanner.trustStrong}</strong> {dict.scanner.trustRest}
            </p>
          </div>
        </div>
      </section>

      {/* ③.5 새로 추가된 스킬 — RSS(whats-new.xml)와 동일 소스를 홈에 노출 */}
      <section id="whats-new" className="mx-auto max-w-5xl px-5 py-12 scroll-mt-20">
        <h2 className="font-serif text-3xl font-black text-ink sm:text-4xl">
          {dict.whatsNew.sectionLabel} <span className="text-[var(--accent)]">{dict.whatsNew.sectionAccent}</span>
          {dict.whatsNew.sectionAfter ? ` ${dict.whatsNew.sectionAfter}` : ""}
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-[var(--ink-soft)]">{dict.whatsNew.sectionDesc}</p>
        <WhatsNewList locale={loc} dict={dict} />
      </section>

      {/* ④ 구독 */}
      <section id="subscribe" className="mx-auto max-w-5xl px-5 py-12 scroll-mt-20">
        <div className="paper-card rounded-xl px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-serif text-2xl font-black text-ink sm:text-3xl">{dict.subscribeHome.heading}</h2>
              <p className="mt-3 text-[var(--ink-soft)]">{dict.subscribeHome.body}</p>
            </div>
            <SubscribeForm dict={dict} />
          </div>
        </div>
      </section>

      {/* 프라이싱 CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--ink-soft)]">{dict.pricingCta.note}</p>
          <Link href={`/${loc}/pricing`} className="btn-ghost rounded-md px-5 py-2.5 font-medium">
            {dict.pricingCta.link}
          </Link>
        </div>
      </section>
    </SiteChrome>
  );
}
