import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 이용약관 — 이중언어 단일 페이지(한국어 본문 + 영어 전문 병기).
// 색인 서비스의 성격(재호스팅 없음), 이중 라이선스, 면책, 준거법을 명시. source-policy·privacy와 동일 구조.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: "이용약관 · Terms of Service",
    description:
      "claude-checkup 서비스 이용약관 — 서비스 내용, 콘텐츠 라이선스, 면책, 준거법. Terms of service: what the service is, content licensing, disclaimers, and governing law.",
    alternates: alternatesFor(loc, "/terms"),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">Terms of Service</p>
        <h1 className="font-serif text-hero font-black text-ink">이용약관</h1>
        <p className="mt-3 text-sm text-[var(--ink-faint)]">시행일 2026년 7월 9일</p>

        <Block title="① 목적 및 서비스 내용">
          <p>
            claude-checkup(이하 &ldquo;서비스&rdquo;)은 공개된 Claude Code 스킬을 색인·검색·소개하는 무료
            서비스입니다. 서비스는 스킬 코드를 재호스팅하지 않으며, 설치와 상세 확인은 항상 원저장소로 연결됩니다.
          </p>
        </Block>

        <Block title="② 콘텐츠와 라이선스">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>색인된 각 스킬의 저작권은 해당 원저작자에게 있습니다.</li>
            <li>
              서비스가 더한 한국어 예시 프롬프트·큐레이션·코드는 이중 라이선스로 제공됩니다: 코드는 MIT, 한국어
              프롬프트와 큐레이션은 CC BY-NC 4.0 (원저작물의 이름·설명은 제외).
            </li>
            <li>
              자세한 내용은{" "}
              <a href={`/${loc}/source-policy`} className="link-ink">
                출처 정책
              </a>{" "}
              및 저장소의 <code>LICENSE</code>, <code>LICENSE-DATA.md</code>를 참조하세요.
            </li>
          </ul>
        </Block>

        <Block title="③ 면책">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              서비스는 색인 정보를 &ldquo;있는 그대로(as is)&rdquo; 제공하며 정확성·최신성·특정 목적 적합성을
              보증하지 않습니다.
            </li>
            <li>각 스킬의 동작과 안전성에 대한 책임은 원저작자에게 있습니다. 설치 전 원저장소를 직접 확인하세요.</li>
            <li>서비스 이용으로 발생한 손해에 대해 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.</li>
          </ul>
        </Block>

        <Block title="④ 이용자의 의무">
          <p>
            서비스를 불법적인 목적으로 이용하거나, 과도한 자동 요청으로 서비스 운영을 방해하는 행위를 금지합니다. 또한
            광고 부정 클릭 및 무효 트래픽을 유발하는 행위를 금지합니다.
          </p>
        </Block>

        <Block title="⑤ 상표">
          <p>claude-checkup은 Anthropic과 무관한 독립 프로젝트입니다. Claude is a trademark of Anthropic, PBC.</p>
        </Block>

        <Block title="⑥ 준거법 및 관할">
          <p>이 약관은 대한민국 법률에 따르며, 서비스 이용과 관련한 분쟁은 대한민국 법원을 관할로 합니다.</p>
        </Block>

        <Block title="⑦ 약관의 변경">
          <p>
            약관이 변경되면 이 페이지에 게시하며, 게시 시점부터 효력이 발생합니다. 현재 시행일: 2026년 7월 9일.
          </p>
        </Block>

        {/* ── 영어 전문 ─────────────────────────────────────────────── */}
        <div className="mt-[var(--space-section)] border-t border-[var(--line-strong)] pt-10">
          <h2 className="font-serif text-title font-black text-ink">Terms of Service</h2>
          <p className="mt-2 text-sm text-[var(--ink-faint)]">Effective July 9, 2026</p>

          <Block title="1. Service">
            <p>
              claude-checkup (the &ldquo;Service&rdquo;) is a free service that indexes, searches, and showcases publicly
              available Claude Code skills. The Service does not rehost skill code; installation and details always link
              back to the original repository.
            </p>
          </Block>

          <Block title="2. Content and licensing">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Each indexed skill remains the copyright of its original author.</li>
              <li>
                The Korean example prompts, curation, and code added by the Service are dual-licensed: code under MIT,
                and the Korean prompts and curation under CC BY-NC 4.0 (excluding the original work&apos;s name and
                description).
              </li>
              <li>
                See the{" "}
                <a href={`/${loc}/source-policy`} className="link-ink">
                  Source Policy
                </a>{" "}
                and the repository&apos;s <code>LICENSE</code> and <code>LICENSE-DATA.md</code> for details.
              </li>
            </ul>
          </Block>

          <Block title="3. Disclaimer">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>The Service provides index information &ldquo;as is&rdquo; and makes no warranty of accuracy, currency, or fitness for a particular purpose.</li>
              <li>Each skill&apos;s behavior and safety are the responsibility of its original author. Review the original repository before installing.</li>
              <li>To the extent permitted by law, the Service is not liable for any damages arising from its use.</li>
            </ul>
          </Block>

          <Block title="4. User obligations">
            <p>
              You must not use the Service for unlawful purposes, disrupt its operation with excessive automated
              requests, or generate fraudulent ad clicks or invalid traffic.
            </p>
          </Block>

          <Block title="5. Trademark">
            <p>claude-checkup is an independent project and is not affiliated with Anthropic. Claude is a trademark of Anthropic, PBC.</p>
          </Block>

          <Block title="6. Governing law">
            <p>These terms are governed by the laws of the Republic of Korea, and disputes are subject to the jurisdiction of Korean courts.</p>
          </Block>

          <Block title="7. Changes">
            <p>If these terms change, we will post the update on this page, effective from the time of posting. Current effective date: July 9, 2026.</p>
          </Block>
        </div>
      </section>
    </SiteChrome>
  );
}

// 정책 블록 — 제목 + 본문. 한국어/영어 섹션 공통 재사용(source-policy·privacy와 동일 패턴).
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
