import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import ScannerTabs from "@/components/ScannerTabs";
import SubscribeForm from "@/components/SubscribeForm";
import { CATEGORY_META, CATEGORY_KEYS } from "@/lib/score";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "클로드 코드 활용 진단 — 당신의 클로드, 몇 점일까요?",
  description:
    "설치한 스킬·에이전트·훅·자동화를 스캔해 Claude Code 활용 수준을 성적표로 진단합니다. 무료·읽기 전용, 개수와 설정 여부만 수집.",
};

// WebSite JSON-LD — 사이트 정체성·검색 액션 힌트.
const webSiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "claude-checkup",
  url: SITE_URL,
  description: "Claude Code 사용 수준 무료 진단·스킬 카탈로그·클로드 데일리 뉴스.",
  inLanguage: "ko-KR",
};

// 랜딩. 히어로 + 스캐너 실행 안내 + 신뢰 문구 + 영역 미리보기 + 구독 + 프라이싱 CTA.
export default function Home() {
  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteLd) }}
      />
      {/* 히어로 */}
      <section className="mx-auto max-w-5xl px-5 pt-14 pb-8 sm:pt-20">
        <p className="mb-4 inline-block rounded-full border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-1 font-mono text-xs text-[var(--ink-soft)]">
          Claude Code 활용도 진단
        </p>
        <h1 className="font-serif text-[2.75rem] font-black leading-[0.98] tracking-tight text-ink sm:text-7xl">
          당신의 클로드,
          <br />
          <span className="text-[var(--accent)]">몇 점</span>일까요?
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">
          설치한 스킬·에이전트·훅·자동화를 스캔해 활용 수준을 성적표로 매깁니다. 몰라서 못 쓰던
          기능을 찾아 개선 명령까지 알려드려요.
        </p>

        {/* 스캐너 실행 */}
        <div className="mt-10 max-w-2xl">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-mono text-sm font-bold text-ink">1. 로컬에서 스캐너 실행</h2>
            <span className="font-mono text-xs text-[var(--ink-faint)]">읽기 전용 · 동의 후 전송</span>
          </div>
          <ScannerTabs />
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            저장소를 clone한 뒤 위 명령을 실행하면, 수집 항목을 터미널에 보여주고 동의(y/N)를 받은 뒤
            결과를 전송합니다. 완료되면 진단 결과 페이지가 열립니다.
          </p>

          {/* 신뢰 문구 — 셀링포인트 */}
          <div className="mt-4 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--paper-2)] px-4 py-3">
            <p className="text-sm leading-relaxed text-ink">
              <strong className="font-semibold">수집: 개수와 설정 여부만.</strong> 파일 내용·이름은
              전송하지 않습니다. 스킬 목록이나 코드가 서버로 가는 일은 없습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 진단 영역 미리보기 */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="font-serif text-2xl text-ink sm:text-3xl">무엇을 진단하나요</h2>
        <p className="mt-2 text-[var(--ink-soft)]">10개 영역을 가중 평균해 총점을 냅니다.</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_KEYS.map((k) => (
            <li key={k} className="paper-card flex flex-col justify-between rounded-lg px-4 py-4">
              <span className="text-sm font-medium leading-snug text-ink">{CATEGORY_META[k].label}</span>
              <span className="mt-3 font-mono text-xs text-[var(--accent)]">가중치 {CATEGORY_META[k].weight}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 구독 */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="paper-card rounded-xl px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-serif text-2xl text-ink sm:text-3xl">매일 클로드 뉴스, 무료로</h2>
              <p className="mt-3 text-[var(--ink-soft)]">
                새 스킬·업데이트·활용 팁을 한국어로 정리해 하루 한 번 보내드립니다. 진단 안 받아도
                구독만 가능해요.
              </p>
            </div>
            <SubscribeForm />
          </div>
        </div>
      </section>

      {/* 프라이싱 CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--ink-soft)]">맞춤 개선 플랜과 주간 재진단이 필요하신가요?</p>
          <Link href="/pricing" className="btn-ghost rounded-md px-5 py-2.5 font-medium">
            프라이싱 보기 →
          </Link>
        </div>
      </section>
    </SiteChrome>
  );
}
