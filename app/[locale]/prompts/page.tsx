import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import PromptLibrary, { type PromptEntry } from "@/components/PromptLibrary";
import promptsData from "@/data/prompts.json";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 프롬프트 라이브러리 — 무설치 진입층(터미널 없이 claude.ai 채팅에 바로 붙여넣는 프롬프트).
// 콘텐츠(제목·설명·본문)는 tier 정책에 따라 ko/en만 유지, UI 크롬은 dict로 16개 로케일 번역.
const prompts = promptsData as PromptEntry[];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: dict.meta.promptsTitle,
    description: dict.meta.promptsDesc,
    alternates: alternatesFor(loc, "/prompts"),
    openGraph: { title: dict.meta.promptsTitle, description: dict.meta.promptsDesc },
  };
}

export default async function PromptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{dict.prompts.eyebrow}</p>
        <h1 className="font-serif text-hero font-black text-ink">
          {dict.prompts.title1} <span className="text-[var(--accent)]">{dict.prompts.titleAccent}</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--ink-soft)]">{dict.prompts.subtitle}</p>

        {/* 무설치 안내 — 터미널 필요 없음 배지 */}
        <p className="mt-4 inline-block rounded-full border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-1 font-mono text-xs text-[var(--ink-soft)]">
          {dict.prompts.noTerminal}
        </p>

        <div className="mt-10">
          <PromptLibrary prompts={prompts} dict={dict} locale={loc} />
        </div>
      </section>
    </SiteChrome>
  );
}
