import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import ScoreCard from "@/components/ScoreCard";
import CategoryBars from "@/components/CategoryBars";
import SubscribeForm from "@/components/SubscribeForm";
import SkillRecs from "@/components/SkillRecs";
import StatTiles from "@/components/StatTiles";
import RadarChart from "@/components/RadarChart";
import SetupChecklist from "@/components/SetupChecklist";
import { db } from "@/lib/db";
import { topGaps, type Category } from "@/lib/score";
import { getDict, isLocale, DEFAULT_LOCALE, HREFLANG, type Locale } from "@/lib/i18n";
import { scoreCatLabel, improveLabel } from "@/lib/i18n-helpers";

// 진단 결과. Next 15: params는 Promise. memory DB라 서버 재시작 시 만료 → 안내.
export const dynamic = "force-dynamic"; // 인메모리 조회는 매 요청 신선하게

// 개인 진단 결과 — 색인 금지(고유 URL이 검색에 노출되면 안 됨).
export const metadata: Metadata = {
  title: "결과",
  robots: { index: false, follow: false },
};

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  const record = await db.getScan(id);

  if (!record) {
    return (
      <SiteChrome locale={loc} dict={dict}>
        <section className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="stamp stamp--low mx-auto mb-6 h-20 w-20 text-3xl" aria-hidden>
            ?
          </div>
          <h1 className="font-serif text-3xl text-ink">{dict.result.notFoundTitle}</h1>
          <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">{dict.result.notFoundBody}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href={`/${loc}`} className="btn-accent rounded-md px-6 py-3 font-semibold">
              {dict.result.notFoundRetry}
            </Link>
            <Link href={`/${loc}/catalog`} className="btn-ghost rounded-md px-6 py-3 font-medium">
              {dict.result.notFoundCatalog}
            </Link>
          </div>
        </section>
      </SiteChrome>
    );
  }

  const gaps = topGaps(record.categories, 3);
  // 레이더 축 = 전체 카테고리(라벨 번역 + 점수). 막대와 같은 데이터의 형상(shape) 뷰.
  const radarAxes = record.categories.map((c: Category) => ({ label: scoreCatLabel(dict, c.key), value: c.score }));
  // "불필요" 카테고리 — 추천 없이 "지금은 무시해도 됩니다" 안내만.
  const skips = record.categories.filter((c: Category) => c.verdict === "불필요");
  const created = new Date(record.createdAt);
  const whenStr = created.toLocaleString(HREFLANG[loc], { dateStyle: "medium", timeStyle: "short" });

  return (
    <SiteChrome locale={loc} dict={dict}>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="mb-3 font-mono text-xs text-[var(--ink-faint)]">
          {dict.result.scannedAt.replace("{when}", whenStr)}
        </p>

        <ScoreCard total={record.scoreTotal} dict={dict} />

        <div className="mt-6">
          <StatTiles totals={record.meta.totals} dict={dict} />
        </div>

        <div className="mt-6">
          <RadarChart axes={radarAxes} dict={dict} />
        </div>

        <div className="mt-6">
          <CategoryBars categories={record.categories} dict={dict} />
        </div>

        <div className="mt-6">
          <SetupChecklist flags={record.meta.flags} dict={dict} />
        </div>

        {/* "몰라서 못 쓰는 것" 상위 3개 개선 액션 */}
        {gaps.length > 0 && (
          <section aria-labelledby="gaps-heading" className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
            <h2 id="gaps-heading" className="font-serif text-xl text-ink">
              {dict.result.gapsHeading}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{dict.result.gapsSub}</p>
            <ol className="mt-5 flex flex-col gap-4">
              {gaps.map((c, i) => (
                <li key={c.key} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)] font-mono text-sm font-bold text-[var(--accent-ink)]"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {scoreCatLabel(dict, c.key)}
                      <span className="ml-2 font-mono text-xs text-[var(--ink-faint)]">
                        {c.score}
                        {dict.result.pointsUnit}
                      </span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{improveLabel(dict, c.key)}</p>
                    {/* 카테고리별 추천 상위 2개 + 설치 명령 복사 */}
                    <SkillRecs categoryKey={c.key} dict={dict} n={2} />
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Link href={`/${loc}/catalog`} className="btn-accent inline-block rounded-md px-5 py-2.5 font-semibold">
                {dict.result.gapsCta}
              </Link>
            </div>
          </section>
        )}

        {/* "불필요" 카테고리 — 추천 없이 무시해도 된다는 안내 */}
        {skips.length > 0 && (
          <section aria-labelledby="skip-heading" className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
            <h2 id="skip-heading" className="font-serif text-xl text-ink">
              {dict.result.skipHeading}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{dict.result.skipSub}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {skips.map((c: Category) => (
                <li
                  key={c.key}
                  className="rounded-full border border-[var(--line)] bg-[var(--paper-2)] px-3 py-1 text-sm text-[var(--ink-soft)]"
                >
                  {scoreCatLabel(dict, c.key)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 구독 CTA */}
        <section className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
          <h2 className="font-serif text-xl text-ink">{dict.result.subHeading}</h2>
          <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">{dict.result.subBody}</p>
          <SubscribeForm dict={dict} compact />
        </section>
      </div>
    </SiteChrome>
  );
}
