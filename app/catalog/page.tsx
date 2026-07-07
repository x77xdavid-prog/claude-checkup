import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import CatalogBrowser from "@/components/CatalogBrowser";
import { loadCatalogSync } from "@/lib/catalog";
import { USECASES } from "@/lib/usecases";

// 스킬 카탈로그 — 서버 컴포넌트. public/catalog.json을 요청/빌드 시 동기로 읽어
// CatalogBrowser에 initialItems로 전달 → 구글이 JS 없이 569종 이름·설명을 HTML에서 본다(SEO 핵심).
// force-dynamic: 런타임에 catalog.json이 갱신되면 반영.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claude Code 스킬 카탈로그 569종 — 용도별 정리·설치 명령",
  description:
    "Claude Code 스킬·에이전트·플러그인 569종을 용도별(오케스트레이션·보안·테스트·프론트엔드·SEO 등)로 정리했습니다. 이름·설명·설치 명령을 한 화면에서.",
  openGraph: {
    title: "Claude Code 스킬 카탈로그 569종 — 용도별 정리",
    description: "설치한 스킬로 무엇을 할 수 있는지, 어떤 명령으로 설치하는지 한눈에.",
  },
};

export default function CatalogPage() {
  const items = loadCatalogSync();

  // JSON-LD ItemList — 상위 50개 스킬 name만(전체 넣으면 비대). 검색엔진 리치 결과용.
  const ldItems = (items ?? []).slice(0, 50).map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.name,
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Claude Code 스킬 카탈로그",
    numberOfItems: items?.length ?? 0,
    itemListElement: ldItems,
  };

  return (
    <SiteChrome>
      {ldItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">스킬 카탈로그</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">
          부족한 곳을 채울 <span className="text-[var(--accent)]">스킬</span>
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[var(--ink-soft)]">
          진단에서 나온 약점을 보완할 스킬을 용도별로 찾아보세요. 설치 명령을 복사해 바로 적용할 수
          있습니다.
        </p>

        <div className="mt-10">
          {items === null ? (
            <EmptyState />
          ) : items.length === 0 ? (
            <p className="paper-card rounded-lg px-6 py-10 text-center text-[var(--ink-soft)]">
              카탈로그에 아직 항목이 없습니다.
            </p>
          ) : (
            <CatalogBrowser initialItems={items} />
          )}
        </div>

        {/* SEO — 롱테일 질의("클로드 ppt 스킬")가 이 페이지에 닿게. 실존 스킬만 나열. */}
        {items && items.length > 0 && (
          <section aria-labelledby="usecases-heading" className="mt-16 border-t border-[var(--line-strong)] pt-10">
            <h2 id="usecases-heading" className="font-serif text-3xl font-black text-ink">
              이런 걸 찾으세요?
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-[var(--ink-soft)]">
              하고 싶은 일로 스킬을 찾아보세요. 위 검색창에 용도를 입력하면 추천이 뜹니다.
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {USECASES.map((uc) => {
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
function EmptyState() {
  return (
    <div className="paper-card rounded-xl px-6 py-12 text-center">
      <div className="stamp stamp--low mx-auto mb-5 h-16 w-16 text-2xl" aria-hidden>
        …
      </div>
      <h2 className="font-serif text-2xl text-ink">카탈로그 생성 전</h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-[var(--ink-soft)]">
        스킬 카탈로그 데이터를 준비하고 있습니다. 잠시 후 다시 방문하시면 검색 가능한 스킬 목록이
        표시됩니다.
      </p>
      <Link href="/" className="btn-ghost mt-6 inline-block rounded-md px-5 py-2.5 font-medium">
        ← 홈으로
      </Link>
    </div>
  );
}
