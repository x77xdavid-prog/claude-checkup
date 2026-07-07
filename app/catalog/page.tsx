import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import CatalogBrowser from "@/components/CatalogBrowser";
import { loadCatalog } from "@/lib/catalog";

// 스킬 카탈로그. public/catalog.json 로드(없으면 "생성 전" 안내 — 다른 에이전트가 생성 중).
// 런타임에 파일이 생기면 반영되도록 동적 렌더.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const items = await loadCatalog();

  return (
    <SiteChrome>
      <section className="mx-auto max-w-4xl px-5 py-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">스킬 카탈로그</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">
          부족한 곳을 채울 <span className="text-[var(--accent)]">스킬</span>
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[var(--ink-soft)]">
          진단에서 나온 약점을 보완할 스킬을 찾아보세요. 설치 명령을 복사해 바로 적용할 수 있습니다.
        </p>

        <div className="mt-10">
          {items === null ? (
            <EmptyState />
          ) : items.length === 0 ? (
            <p className="paper-card rounded-lg px-6 py-10 text-center text-[var(--ink-soft)]">
              카탈로그에 아직 항목이 없습니다.
            </p>
          ) : (
            <CatalogBrowser items={items} />
          )}
        </div>
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
