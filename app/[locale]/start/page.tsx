import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import StartWizard from "@/components/StartWizard";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 1분 시작 + 레벨 테스트 — 초보 온보딩의 첫 문. 5문항으로 지금 수준을 확인하고
// 딱 맞는 다음 세 걸음(실존 라우트)을 처방한다. 점수·순위 없음. 위저드는 클라이언트 컴포넌트.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: dict.meta.startTitle,
    description: dict.meta.startDesc,
    alternates: alternatesFor(loc, "/start"),
    openGraph: { title: dict.meta.startTitle, description: dict.meta.startDesc },
  };
}

export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{dict.start.eyebrow}</p>
        <h1 className="font-serif text-[2.5rem] font-black leading-[1.02] tracking-tight text-ink sm:text-6xl">
          {dict.start.title1} <span className="text-[var(--accent)]">{dict.start.titleAccent}</span>
          {dict.start.title2 ? ` ${dict.start.title2}` : ""}
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[var(--ink-soft)]">{dict.start.subtitle}</p>

        <StartWizard dict={dict} locale={loc} />
      </section>
    </SiteChrome>
  );
}
