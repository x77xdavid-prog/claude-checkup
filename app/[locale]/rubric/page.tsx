import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 검증 루브릭 — 배지(미검증/검증/마켓)가 부여되는 기준과 향후 제출 심사 기준의 선공개.
// source-policy와 동일한 이중언어 단일 페이지(한국어 본문 + 영어 전문 병기).
// 본문은 로케일에 따라 갈라지지 않는다(정책 문서 — 원문 그대로 정확히 전달).
// 원칙: 이 문서의 모든 문장은 현재 시스템이 실제로 하는 것과 일치해야 한다.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: "검증 루브릭 · Verification Rubric",
    description:
      "claude-checkup 카탈로그 배지(미검증/검증/마켓)가 부여되는 기준과 스킬 제출 심사 기준의 선공개. How claude-checkup verifies skills: badge criteria, what we do not check, and the submission review checklist.",
    alternates: alternatesFor(loc, "/rubric"),
  };
}

export default async function RubricPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">
          Verification Rubric
        </p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">검증 루브릭</h1>

        <Block title="① 왜 기준을 먼저 공개하나">
          <p>
            품질 게이트 없는 카탈로그는 무너집니다. 그래서 우리는 심사 기준을 먼저 공개하고, 공개한 그 기준으로만
            심사합니다. 기준이 바뀌면 이 문서를 먼저 바꿉니다. 이 문서에 적힌 모든 문장은 현재 시스템이 실제로
            하는 것과 일치하도록 유지하며, 아직 하지 않는 것은 &lsquo;예정&rsquo;으로 표기합니다.
          </p>
        </Block>

        <Block title="② 배지 3단의 의미">
          <p>
            카탈로그의 모든 항목에는 &ldquo;설치 신뢰도&rdquo; 배지가 붙습니다 — <strong>미검증</strong>(△),{" "}
            <strong>검증된 저장소</strong>(✓), <strong>큐레이션 마켓</strong>(◆) 셋 중 하나입니다.
          </p>
          <p className="mt-2">
            <strong>미검증(출처 미확인 · 직접 검색)</strong> — 아래 ③의 확인을 아직 통과하지 못한 항목입니다.
            존재 자체가 거짓이라는 뜻이 아니라 <em>확인 전</em>이라는 뜻입니다. 나쁨 표시가 아닙니다. 이 항목에는
            원클릭 설치 명령과 출처 링크를 제공하지 않습니다 — 확인되지 않은 명령이나 링크를 만들어 붙이지 않는
            것이 원칙이기 때문입니다.
          </p>
          <p className="mt-2">
            <strong>검증된 저장소(원본 저장소 확인됨)</strong> — 원저장소 실존·설치 경로·동일성을 확인한
            항목입니다(기준은 ③). 카드에 실제 설치 명령과 원저장소 링크, 확인된 라이선스를 표기합니다.
          </p>
          <p className="mt-2">
            <strong>큐레이션 마켓(원클릭 설치 · 큐레이션)</strong> — Claude Code 플러그인 마켓플레이스를 통한
            원클릭 설치 경로가 확인된 항목입니다. 자사 checkup-skills 마켓과 서드파티 마켓을 모두 포함하며, 카드의
            설치 명령은 해당 마켓의 실제 <code>/plugin install</code> 명령입니다.
          </p>
        </Block>

        <Block title="③ &lsquo;검증&rsquo; 배지의 기준">
          <p>&lsquo;검증된 저장소&rsquo; 배지는 다음 3중 기준을 모두 통과한 항목에만 부여합니다.</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong>실존</strong> — 해당 검증 실행에서 GitHub API(git tree)로 스킬 파일이 원저장소에 실제
              존재함을 확인합니다.
            </li>
            <li>
              <strong>정직한 설치 경로</strong> — 카드에 안내하는 설치 명령이 실제로 그 저장소의 그 스킬을
              설치합니다. 확인하지 못한 항목에는 추측성 설치 명령을 만들어내지 않습니다.
            </li>
            <li>
              <strong>동일성</strong> — 저장소 귀속은 근거(git remote, 마켓 사본 대조, 스킬 본문의 저장소 링크
              등)로만 판정하며 추측 URL은 쓰지 않습니다. 그 저장소 안에 해당 스킬 파일의 실존을 대조해, 이름만
              같은 다른 스킬로 연결되는 경우를 배제합니다.
            </li>
          </ul>
          <p className="mt-2">
            검증은 <strong>그 실행 시점의 확인(스냅샷)</strong>입니다. 재검증에서 확인에 실패하면 — 저장소 접근
            불가를 포함해 — &lsquo;검증&rsquo;으로 표기하지 않습니다(강등). 상류(원저장소)의 라이선스 변경과
            아카이브 상태를 추적해 변경이 감지되면 표기를 갱신하거나 항목을 내립니다.
          </p>
        </Block>

        <Block title="④ 우리가 확인하지 않는 것 (한계 고지)">
          <p>
            이 검증은 <strong>코드 보안 감사가 아니며, 품질·성능 보증도 아닙니다.</strong> 우리가 확인하는 것은
            실존·출처·설치 경로입니다. 설치 전 코드 확인은 사용자의 몫이며, 출처가 확인된 카드(검증·마켓)에는
            원저장소 링크를 표기해 설치 전에 코드를 직접 볼 수 있게 합니다 — 출처 미확인 항목에는 확인되지 않은
            링크를 만들어 달지 않습니다. 자동 품질 채점 리포트는 후속 계획입니다(예정).
          </p>
        </Block>

        <Block title="⑤ 색인 최소 기준">
          <p>
            색인 최소 기준은{" "}
            <Link href={`/${loc}/source-policy`} className="link-ink">
              출처 정책
            </Link>
            의 기준과 동일합니다.
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>공개(public) GitHub 저장소에 있을 것</li>
            <li>OSI 승인 오픈소스 라이선스를 명시할 것</li>
            <li>표준 SKILL.md 형식을 따를 것</li>
          </ul>
        </Block>

        <Block title="⑥ 제출 심사 체크리스트 (선공개)">
          <p>
            스킬 등재 신청은{" "}
            <a
              href="https://github.com/x77xdavid-prog/claude-checkup/issues/new?template=skill-submission.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="link-ink"
            >
              제출 폼(GitHub 이슈 폼)
            </a>
            으로 받습니다 — 심사 과정도 그 이슈에 <strong>공개로</strong> 남습니다. 자유 형식{" "}
            <a
              href="https://github.com/x77xdavid-prog/claude-checkup/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="link-ink"
            >
              일반 이슈
            </a>
            로 제안해도 됩니다. 제출은 아래 기준으로 심사합니다.
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>⑤의 색인 최소 기준을 충족할 것</li>
            <li>설명과 실제 기능이 일치할 것 — 과장·허위는 반려</li>
            <li>파괴적 동작(파일 삭제·외부 전송 등)이 있으면 본문에 명시할 것</li>
            <li>기존 항목과 이름 충돌이 없을 것</li>
            <li>등재 시 우리가 한국어 예시 프롬프트 10개를 작성해 붙입니다</li>
          </ul>
        </Block>

        <Block title="⑦ 강등·제외와 이의">
          <p>
            허위가 발견되면 배지를 강등하거나 항목을 제외합니다. 이의·재심은{" "}
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
            로 요청해 주세요. 출처 정책과 동일한 채널·동일한 기준으로, 확인 즉시, 늦어도 24시간 이내에
            처리합니다.
          </p>
        </Block>

        {/* ── 영어 전문 ─────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-[var(--line-strong)] pt-10">
          <h2 className="font-serif text-3xl font-black text-ink">Verification rubric</h2>

          <Block title="1. Why we publish the criteria first">
            <p>
              A catalog without a quality gate collapses. So we publish the review criteria first, and we review
              only against what we published. When the criteria change, this document changes first. Every sentence
              here is kept in line with what the system actually does today; anything we do not do yet is marked as
              planned.
            </p>
          </Block>

          <Block title="2. What the three badges mean">
            <p>
              Every catalog entry carries an &ldquo;install trust&rdquo; badge — one of <strong>unverified</strong>{" "}
              (△), <strong>verified repo</strong> (✓), or <strong>curated market</strong> (◆).
            </p>
            <p className="mt-2">
              <strong>Unverified</strong> — the entry has not yet passed the checks in section 3. It does not mean
              the skill is fake; it means <em>not yet checked</em>. It is not a negative mark. These cards get no
              one-click install command and no source link, because we do not fabricate commands or links we have
              not confirmed.
            </p>
            <p className="mt-2">
              <strong>Verified repo</strong> — we confirmed existence, an honest install path, and identity (see
              section 3). The card shows the actual install command, a link to the original repository, and the
              license where confirmed.
            </p>
            <p className="mt-2">
              <strong>Curated market</strong> — a one-click install path through a Claude Code plugin marketplace
              has been confirmed. This covers both our own checkup-skills marketplace and third-party marketplaces;
              the command on the card is the marketplace&apos;s actual <code>/plugin install</code> command.
            </p>
          </Block>

          <Block title="3. Criteria for the &lsquo;verified&rsquo; badge">
            <p>The &lsquo;verified repo&rsquo; badge is granted only when all three checks pass:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Existence</strong> — during that verification run, the skill file is confirmed to actually
                exist in the original repository via the GitHub API (git tree).
              </li>
              <li>
                <strong>Honest install path</strong> — the install command we show actually installs that skill
                from that repository. We never generate speculative install commands for unconfirmed entries.
              </li>
              <li>
                <strong>Identity</strong> — repository attribution is evidence-based only (git remote, comparison
                against marketplace clones, repository links in the skill body); we never guess URLs. We match the
                skill file inside that repository, ruling out a different skill that merely shares the name.
              </li>
            </ul>
            <p className="mt-2">
              Verification is a <strong>snapshot of that run</strong>. If a re-check fails — including when the
              repository becomes unreachable — the entry is no longer marked verified (demotion). We track upstream
              license changes and archive status, and update or downgrade the listing when a change is detected.
            </p>
          </Block>

          <Block title="4. What we do not check (limitations)">
            <p>
              This is <strong>not a code security audit and not a quality or performance guarantee.</strong> What
              we verify is existence, provenance, and the install path. Reviewing the code before installing is on
              you — cards with a confirmed source (verified / market) link to the original repository so you can
              read the code first, and unconfirmed entries get no fabricated link. An automated quality scoring
              report is on the roadmap (planned).
            </p>
          </Block>

          <Block title="5. Minimum indexing criteria">
            <p>
              The minimum bar for indexing is the same as in the{" "}
              <Link href={`/${loc}/source-policy`} className="link-ink">
                Source Policy
              </Link>
              :
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Hosted in a public GitHub repository</li>
              <li>Published under an OSI-approved open-source license</li>
              <li>Follows the standard SKILL.md format</li>
            </ul>
          </Block>

          <Block title="6. Submission review checklist (published in advance)">
            <p>
              Submissions are accepted through the{" "}
              <a
                href="https://github.com/x77xdavid-prog/claude-checkup/issues/new?template=skill-submission.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="link-ink"
              >
                submission form (a GitHub issue form)
              </a>{" "}
              — the review itself stays <strong>public</strong> in that issue. A free-form{" "}
              <a
                href="https://github.com/x77xdavid-prog/claude-checkup/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="link-ink"
              >
                regular issue
              </a>{" "}
              works too. Submissions are reviewed against:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Meets the minimum indexing criteria in section 5</li>
              <li>Description matches actual behavior — exaggeration or false claims are rejected</li>
              <li>Destructive behavior (file deletion, sending data externally, etc.) must be disclosed</li>
              <li>No name collision with existing entries</li>
              <li>On listing, we write and attach 10 example Korean prompts</li>
            </ul>
          </Block>

          <Block title="7. Demotion, removal, and appeals">
            <p>
              If a claim turns out to be false, we demote the badge or remove the entry. To appeal or request a
              re-review, open an issue at{" "}
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
              . Same channel and same SLA as the Source Policy: we act on verified requests within 24 hours.
            </p>
          </Block>
        </div>
      </section>
    </SiteChrome>
  );
}

// 정책 블록 — 제목 + 본문. 한국어/영어 섹션 공통으로 재사용(source-policy와 동일 패턴).
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
