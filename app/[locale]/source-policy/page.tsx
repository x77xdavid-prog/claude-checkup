import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 출처 정책 — 이중언어 단일 페이지(한국어 본문 + 영어 전문 병기).
// 16로케일 라우팅/헤더·푸터는 유지하되 본문 자체는 로케일에 따라 갈라지지 않는다
// (번역 부채 회피 — 정책 문서는 원문 그대로 정확히 전달돼야 하는 성격이 강함).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: "출처 정책 · Source Policy",
    description:
      "claude-checkup의 스킬 색인 원칙 — 재호스팅 없이 원저장소로 라우팅, 출처 크레딧, 제외 요청 방법. How claude-checkup indexes skills: no rehosting, credit to source, and how to request removal.",
    alternates: alternatesFor(loc, "/source-policy"),
  };
}

export default async function SourcePolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">Source Policy</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">출처 정책</h1>

        <Block title="① 원칙">
          <p>
            claude-checkup은 공개된 Claude Code 스킬을 색인할 뿐, 코드를 재호스팅하지 않습니다. 설치·상세 확인은
            항상 원저장소로 연결됩니다.
          </p>
        </Block>

        <Block title="② 색인 기준">
          <p>다음 기준을 모두 충족하는 스킬만 색인합니다.</p>
          <ul className="mt-2 list-disc pl-5">
            <li>공개(public) GitHub 저장소에 있을 것</li>
            <li>OSI 승인 오픈소스 라이선스를 명시할 것</li>
            <li>표준 SKILL.md 형식을 따를 것</li>
          </ul>
          <p className="mt-2">
            색인된 항목에 배지(미검증/검증/마켓)가 부여되는 기준은{" "}
            <Link href={`/${loc}/rubric`} className="link-ink">
              검증 루브릭
            </Link>
            을 참고하세요.
          </p>
        </Block>

        <Block title="③ 크레딧">
          <p>
            카탈로그의 모든 외부 스킬 카드에는 출처, 원저장소 링크, 라이선스를 표기합니다. 원저작자의 이름과
            저장소를 가리는 일은 없습니다.
          </p>
        </Block>

        <Block title="④ 우리가 추가하는 것">
          <p>
            각 스킬에 한국어 예시 프롬프트 10개, 카테고리 분류, 검색 기능을 더합니다. 스킬 자체의 코드나 설명은
            원문 그대로 유지합니다(번역하지 않음).
          </p>
        </Block>

        <Block title="⑤ 제외 요청">
          <p>
            원저작자로서 자신의 스킬이 카탈로그에서 제외되길 원하시면{" "}
            <a
              href="https://github.com/x77xdavid-prog/claude-checkup/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="link-ink"
            >
              GitHub 이슈
            </a>{" "}
            또는{" "}
            <a href="mailto:x77xdavid@gmail.com" className="link-ink">
              이메일
            </a>
            로 요청해 주세요. 확인 즉시, 늦어도 24시간 이내에 반영합니다.
          </p>
        </Block>

        <Block title="⑥ 자동 추적">
          <p>
            상류(원저장소)의 라이선스 변경과 저장소 아카이브 상태를 자동으로 추적합니다. 변경이 감지되면 카탈로그
            표기를 갱신하거나 항목을 내립니다.
          </p>
        </Block>

        <Block title="⑦ 상표">
          <p>claude-checkup은 Anthropic과 무관한 독립 프로젝트입니다. Claude is a trademark of Anthropic, PBC.</p>
        </Block>

        {/* ── 영어 전문 ─────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-[var(--line-strong)] pt-10">
          <h2 className="font-serif text-3xl font-black text-ink">For skill authors</h2>

          <Block title="1. Principle">
            <p>
              claude-checkup indexes publicly available Claude Code skills — it does not rehost code. Every install
              and detail link routes back to the original repository.
            </p>
          </Block>

          <Block title="2. Indexing criteria">
            <p>We only index skills that meet all of the following:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Hosted in a public GitHub repository</li>
              <li>Published under an OSI-approved open-source license</li>
              <li>Follow the standard SKILL.md format</li>
            </ul>
            <p className="mt-2">
              For how badges (unverified / verified / market) are assigned to indexed skills, see the{" "}
              <Link href={`/${loc}/rubric`} className="link-ink">
                Verification Rubric
              </Link>
              .
            </p>
          </Block>

          <Block title="3. Credit">
            <p>
              Every external skill card in the catalog shows its source, a link to the original repository, and its
              license. We never obscure the original author or repository.
            </p>
          </Block>

          <Block title="4. What we add">
            <p>
              We layer on 10 example Korean prompts per skill, category classification, and search. The skill&apos;s
              own code and description stay untouched in the original language.
            </p>
          </Block>

          <Block title="5. Removal requests">
            <p>
              If you&apos;re the original author and want your skill removed from the catalog, open an issue at{" "}
              <a
                href="https://github.com/x77xdavid-prog/claude-checkup/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="link-ink"
              >
                github.com/x77xdavid-prog/claude-checkup
              </a>{" "}
              or email{" "}
              <a href="mailto:x77xdavid@gmail.com" className="link-ink">
                x77xdavid@gmail.com
              </a>
              . We act on verified requests within 24 hours.
            </p>
          </Block>

          <Block title="6. Automated tracking">
            <p>
              We automatically track upstream license changes and repository archive status. When a change is
              detected, we update the catalog listing or remove the entry.
            </p>
          </Block>

          <Block title="7. Trademark">
            <p>
              claude-checkup is an independent project and is not affiliated with Anthropic. Claude is a trademark of
              Anthropic, PBC.
            </p>
          </Block>
        </div>
      </section>
    </SiteChrome>
  );
}

// 정책 블록 — 제목 + 본문. 한국어/영어 섹션 공통으로 재사용.
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
