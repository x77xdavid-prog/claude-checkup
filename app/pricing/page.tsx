import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import SubscribeForm from "@/components/SubscribeForm";

// 프라이싱: 무료 vs 구독 비교. 실결제는 P4 → 지금은 대기자 등록(구독 폼).
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "프라이싱",
  description: "claude-checkup 요금제. 진단과 뉴스레터는 무료, 맞춤 개선 플랜·주간 재진단은 Pro 구독.",
};

const FREE = [
  "진단 점수 + 영역별 리포트",
  "몰라서 못 쓰는 기능 진단",
  "부족 스킬 추천 · 설치 명령",
  "일일 클로드 뉴스레터",
];

const PRO = [
  "무료의 모든 기능",
  "맞춤 개선 플랜 (내 약점 기준)",
  "주간 재진단 · 점수 추적",
  "프리미엄 스킬 큐레이션",
  "우선 지원",
];

export default function PricingPage() {
  return (
    <SiteChrome>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">
          요금제
        </p>
        <h1 className="text-center font-serif text-4xl font-black text-ink sm:text-5xl">
          무료로 시작, 필요할 때 <span className="text-[var(--accent)]">구독</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center leading-relaxed text-[var(--ink-soft)]">
          진단과 뉴스레터는 계속 무료입니다. 개선을 체계적으로 추적하고 싶을 때만 구독하세요.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* 무료 */}
          <div className="paper-card flex flex-col rounded-xl px-6 py-8">
            <h2 className="font-serif text-2xl text-ink">무료</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">지금 바로</p>
            <p className="mt-6 font-mono text-4xl font-bold text-ink">
              ₩0<span className="ml-1 text-base font-normal text-[var(--ink-soft)]">/ 영원히</span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2 text-ink">
                  <span className="text-[var(--c-good)]" aria-hidden>
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/" className="btn-ghost mt-8 rounded-md px-5 py-3 text-center font-medium">
              진단 시작하기
            </Link>
          </div>

          {/* 구독 (Pro) — 강조 */}
          <div className="paper-card relative flex flex-col rounded-xl px-6 py-8 ring-2 ring-[var(--accent)]">
            <span className="absolute -top-3 left-6 rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-xs font-bold text-white">
              준비 중
            </span>
            <h2 className="font-serif text-2xl text-ink">Pro 구독</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">개선을 추적하는 사람에게</p>
            <p className="mt-6 font-mono text-4xl font-bold text-ink">
              곧 공개
              <span className="ml-2 align-middle text-base font-normal text-[var(--ink-soft)]">
                대기자 우선 안내
              </span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {PRO.map((f) => (
                <li key={f} className="flex gap-2 text-ink">
                  <span className="text-[var(--accent)]" aria-hidden>
                    ★
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <p className="mb-2 text-sm text-[var(--ink-soft)]">
                오픈 시 가장 먼저 알려드릴게요. 이메일만 남겨주세요.
              </p>
              <SubscribeForm compact />
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-lg text-center text-sm text-[var(--ink-faint)]">
          결제는 아직 열려 있지 않습니다. 대기자로 등록하면 요금제 확정과 함께 우선 안내드립니다.
        </p>
      </section>
    </SiteChrome>
  );
}
