import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import SubscribeForm from "@/components/SubscribeForm";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 프라이싱: 무료 vs 구독 비교. 실결제는 P4 → 지금은 대기자 등록(구독 폼).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: dict.meta.pricingTitle,
    description: dict.meta.pricingDesc,
    alternates: alternatesFor(loc, "/pricing"),
  };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  const p = dict.pricing;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">
          {p.eyebrow}
        </p>
        <h1 className="text-center font-serif text-4xl font-black text-ink sm:text-5xl">
          {p.title1} <span className="text-[var(--accent)]">{p.titleAccent}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center leading-relaxed text-[var(--ink-soft)]">{p.subtitle}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* 무료 */}
          <div className="paper-card flex flex-col rounded-xl px-6 py-8">
            <h2 className="font-serif text-2xl text-ink">{p.freeName}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{p.freeTag}</p>
            <p className="mt-6 font-mono text-4xl font-bold text-ink">
              ₩0<span className="ml-1 text-base font-normal text-[var(--ink-soft)]">{p.freePriceUnit}</span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {p.free.map((f) => (
                <li key={f} className="flex gap-2 text-ink">
                  <span className="text-[var(--c-good)]" aria-hidden>
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href={`/${loc}`} className="btn-ghost mt-8 rounded-md px-5 py-3 text-center font-medium">
              {p.freeCta}
            </Link>
          </div>

          {/* 구독 (Pro) — 강조 */}
          <div className="paper-card relative flex flex-col rounded-xl px-6 py-8 ring-2 ring-[var(--accent)]">
            <span className="absolute -top-3 left-6 rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-xs font-bold text-white">
              {p.proBadge}
            </span>
            <h2 className="font-serif text-2xl text-ink">{p.proName}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{p.proTag}</p>
            <p className="mt-6 font-mono text-4xl font-bold text-ink">
              {p.proPriceMain}
              <span className="ml-2 align-middle text-base font-normal text-[var(--ink-soft)]">
                {p.proPriceSub}
              </span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {p.pro.map((f) => (
                <li key={f} className="flex gap-2 text-ink">
                  <span className="text-[var(--accent)]" aria-hidden>
                    ★
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <p className="mb-2 text-sm text-[var(--ink-soft)]">{p.proNote}</p>
              <SubscribeForm dict={dict} compact />
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-lg text-center text-sm text-[var(--ink-faint)]">{p.footNote}</p>
      </section>
    </SiteChrome>
  );
}
