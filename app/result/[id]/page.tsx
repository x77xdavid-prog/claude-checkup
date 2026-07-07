import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import ScoreCard from "@/components/ScoreCard";
import CategoryBars from "@/components/CategoryBars";
import SubscribeForm from "@/components/SubscribeForm";
import { db } from "@/lib/db";
import { topGaps, improveActionFor } from "@/lib/score";

// 진단 결과. Next 15: params는 Promise. memory DB라 서버 재시작 시 만료 → 안내.
export const dynamic = "force-dynamic"; // 인메모리 조회는 매 요청 신선하게

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await db.getScan(id);

  if (!record) {
    return (
      <SiteChrome>
        <section className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="stamp stamp--low mx-auto mb-6 h-20 w-20 text-3xl" aria-hidden>
            ?
          </div>
          <h1 className="font-serif text-3xl text-ink">진단서를 찾을 수 없어요</h1>
          <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
            결과가 만료되었거나 존재하지 않는 주소입니다. 진단 결과는 임시 보관되며 일정 시간이 지나면
            사라집니다. 스캐너를 다시 실행해 새 진단서를 받아보세요.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className="btn-accent rounded-md px-6 py-3 font-semibold">
              다시 진단하기
            </Link>
            <Link href="/catalog" className="btn-ghost rounded-md px-6 py-3 font-medium">
              카탈로그 보기
            </Link>
          </div>
        </section>
      </SiteChrome>
    );
  }

  const gaps = topGaps(record.categories, 3);
  const created = new Date(record.createdAt);

  return (
    <SiteChrome>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="mb-3 font-mono text-xs text-[var(--ink-faint)]">
          진단 일시 {created.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
        </p>

        <ScoreCard total={record.scoreTotal} />

        <div className="mt-6">
          <CategoryBars categories={record.categories} />
        </div>

        {/* "몰라서 못 쓰는 것" 상위 3개 개선 액션 */}
        {gaps.length > 0 && (
          <section aria-labelledby="gaps-heading" className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
            <h2 id="gaps-heading" className="font-serif text-xl text-ink">
              지금 채우면 점수가 오르는 곳
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              몰라서 못 쓰고 있던 기능 중 영향이 큰 순서입니다.
            </p>
            <ol className="mt-5 flex flex-col gap-4">
              {gaps.map((c, i) => (
                <li key={c.key} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)] font-mono text-sm font-bold text-[var(--accent-ink)]"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink">
                      {c.label}
                      <span className="ml-2 font-mono text-xs text-[var(--ink-faint)]">{c.score}점</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{improveActionFor(c.key)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Link href="/catalog" className="btn-accent inline-block rounded-md px-5 py-2.5 font-semibold">
                개선 스킬 카탈로그 →
              </Link>
            </div>
          </section>
        )}

        {/* 구독 CTA */}
        <section className="paper-card mt-6 rounded-xl px-5 py-6 sm:px-8 sm:py-7">
          <h2 className="font-serif text-xl text-ink">개선 소식을 계속 받아보세요</h2>
          <p className="mt-1 mb-4 text-sm text-[var(--ink-soft)]">
            새 스킬과 활용 팁을 하루 한 번 한국어로 정리해 보냅니다.
          </p>
          <SubscribeForm compact />
        </section>
      </div>
    </SiteChrome>
  );
}
