import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 개인정보처리방침 — 이중언어 단일 페이지(한국어 본문 + 영어 전문 병기).
// 한국 개인정보보호법(PIPA) 필수 고지 항목 + Google AdSense 심사 필수 쿠키/광고 고지를 함께 담는다.
// 내용은 실제 수집 실태에 정확히 일치(파일 내용·이름·IP·기기ID 미수집). 존재하지 않는 동의 배너를
// 있다고 적지 않는다 — 이 프로젝트의 정직성 원칙. 시행일 2026-07-09.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: "개인정보처리방침 · Privacy Policy",
    description:
      "claude-checkup이 수집하는 정보와 처리 방식, 쿠키·광고(Google AdSense), 이용자 권리. What claude-checkup collects, how it is used, cookies and advertising (Google AdSense), and your rights.",
    alternates: alternatesFor(loc, "/privacy"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">Privacy Policy</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">개인정보처리방침</h1>
        <p className="mt-3 text-sm text-[var(--ink-faint)]">시행일 2026년 7월 9일</p>

        <Block title="① 수집하는 개인정보 항목">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <b>이메일 주소</b> — 업데이트 구독을 직접 신청한 경우에 한합니다.
            </li>
            <li>
              <b>진단 결과 데이터</b> — 스킬 진단 시 총점·카테고리 점수·설정 여부 플래그.{" "}
              <b>파일 내용·파일명·경로는 수집하지 않습니다.</b>
            </li>
            <li>
              <b>검색 로그</b> — 카탈로그에 입력한 검색어(익명, 개인 식별자 없음).
            </li>
            <li>
              <b>CLI 익명 통계</b> — <code>checkup-skills</code> CLI 사용 시 검색어 또는 스킬명(최대 120자)·CLI
              버전·언어 코드. <b>IP 주소·기기 식별자·개인정보는 수집하지 않습니다.</b>
            </li>
            <li>
              <b>자동 수집 정보</b> — 서비스 운영 과정에서 접속 로그·쿠키가 생성될 수 있습니다(호스팅·광고 목적).
            </li>
          </ul>
        </Block>

        <Block title="② 수집·이용 목적">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>구독 이메일: 서비스 업데이트 안내 발송</li>
            <li>진단·검색·CLI 통계: 서비스 개선, 인기 스킬·검색어의 집계 분석</li>
            <li>광고: 광고 게재 및 성과 측정(Google AdSense)</li>
          </ul>
        </Block>

        <Block title="③ 보유 및 이용 기간">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>구독 이메일: 구독 해지 또는 삭제 요청 시까지</li>
            <li>진단·검색·CLI 통계: 서비스 운영·분석에 필요한 기간</li>
            <li>관련 법령에 별도의 보관 의무가 있는 경우 해당 기간을 준수합니다.</li>
          </ul>
        </Block>

        <Block title="④ 제3자 제공 및 처리위탁">
          <p>서비스 제공을 위해 아래 사업자에 개인정보 처리를 위탁합니다. 그 외 목적으로 제3자에게 판매·제공하지 않습니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Vercel Inc.</b> (미국) — 웹 호스팅 및 접속 로그
            </li>
            <li>
              <b>Supabase</b> — 데이터베이스 저장(서울 리전, ap-northeast-2)
            </li>
            <li>
              <b>Google LLC</b> — 광고 게재(Google AdSense)
            </li>
          </ul>
        </Block>

        <Block title="⑤ 쿠키 및 광고">
          <p>
            이 서비스는 광고 게재에 Google AdSense를 사용합니다. 제3자 공급업체(Google 포함)는 쿠키를 사용하여
            이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Google의 맞춤 광고는{" "}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="link-ink">
                Google 광고 설정
              </a>
              에서 끌 수 있습니다.
            </li>
            <li>
              제3자 공급업체의 쿠키는{" "}
              <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="link-ink">
                www.aboutads.info
              </a>
              에서 일괄 거부할 수 있습니다.
            </li>
            <li>브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 일부 기능이 제한될 수 있습니다.</li>
          </ul>
        </Block>

        <Block title="⑥ 정보주체의 권리">
          <p>
            이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다. 요청은{" "}
            <a href="mailto:x77xdavid@gmail.com" className="link-ink">
              x77xdavid@gmail.com
            </a>
            으로 보내주시면 관련 법령에 따라 지체 없이 조치합니다. 구독 이메일은 각 메일의 수신거부 링크로도 즉시
            해지됩니다.
          </p>
        </Block>

        <Block title="⑦ 개인정보의 파기">
          <p>
            보유 기간이 지나거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자적 파일 형태의 정보는 복구할 수 없는
            방법으로 삭제합니다.
          </p>
        </Block>

        <Block title="⑧ 아동의 개인정보">
          <p>
            이 서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 해당 아동의 개인정보를 알면서 수집하지 않습니다.
          </p>
        </Block>

        <Block title="⑨ 안전성 확보 조치">
          <p>
            데이터베이스 접근은 서버 측 자격증명으로만 이뤄지며 공개(anon) 접근을 차단합니다(RLS·권한 회수). 모든
            통신은 HTTPS로 암호화됩니다.
          </p>
        </Block>

        <Block title="⑩ 개인정보 보호책임자">
          <p>
            책임자: 최필관 (Choi Pil-kwan) · 이메일:{" "}
            <a href="mailto:x77xdavid@gmail.com" className="link-ink">
              x77xdavid@gmail.com
            </a>
          </p>
        </Block>

        <Block title="⑪ 변경 고지">
          <p>이 방침이 변경되면 변경 내용과 시행일을 이 페이지에 게시합니다. 현재 시행일: 2026년 7월 9일.</p>
        </Block>

        {/* ── 영어 전문 ─────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-[var(--line-strong)] pt-10">
          <h2 className="font-serif text-3xl font-black text-ink">Privacy Policy</h2>
          <p className="mt-2 text-sm text-[var(--ink-faint)]">Effective July 9, 2026</p>

          <Block title="1. Information we collect">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <b>Email address</b> — only if you actively subscribe to updates.
              </li>
              <li>
                <b>Diagnostic results</b> — your total score, per-category scores, and setting flags from a skill
                check-up. <b>We never collect file contents, file names, or paths.</b>
              </li>
              <li>
                <b>Search logs</b> — the queries you type into the catalog (anonymous, no personal identifier).
              </li>
              <li>
                <b>Anonymous CLI stats</b> — when you use the <code>checkup-skills</code> CLI: the search term or skill
                name (max 120 chars), CLI version, and language code. <b>No IP address, device ID, or personal data.</b>
              </li>
              <li>
                <b>Automatically collected</b> — access logs and cookies may be generated while operating the service
                (hosting and advertising).
              </li>
            </ul>
          </Block>

          <Block title="2. How we use it">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Subscription email: to send service updates.</li>
              <li>Diagnostic, search, and CLI stats: to improve the service and analyze popular skills and queries in aggregate.</li>
              <li>Advertising: to serve and measure ads (Google AdSense).</li>
            </ul>
          </Block>

          <Block title="3. Retention">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Subscription email: until you unsubscribe or request deletion.</li>
              <li>Diagnostic, search, and CLI stats: for as long as needed to operate and analyze the service.</li>
              <li>Where the law requires a specific retention period, we comply with it.</li>
            </ul>
          </Block>

          <Block title="4. Third parties and processors">
            <p>We use the following processors to run the service. We do not sell or share your data for any other purpose.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <b>Vercel Inc.</b> (USA) — web hosting and access logs
              </li>
              <li>
                <b>Supabase</b> — database storage (Seoul region, ap-northeast-2)
              </li>
              <li>
                <b>Google LLC</b> — advertising (Google AdSense)
              </li>
            </ul>
          </Block>

          <Block title="5. Cookies and advertising">
            <p>
              This site uses Google AdSense to serve ads. Third-party vendors, including Google, use cookies to serve
              ads based on a user&apos;s prior visits to this website or other websites.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Users may opt out of personalized advertising by visiting{" "}
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="link-ink">
                  Google Ads Settings
                </a>
                .
              </li>
              <li>
                Alternatively, users can opt out of a third-party vendor&apos;s use of cookies for personalized
                advertising at{" "}
                <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="link-ink">
                  www.aboutads.info
                </a>
                .
              </li>
              <li>You can disable cookies in your browser settings, though some features may be limited.</li>
            </ul>
          </Block>

          <Block title="6. Your rights">
            <p>
              You may request access, correction, deletion, or suspension of processing of your personal data. Email{" "}
              <a href="mailto:x77xdavid@gmail.com" className="link-ink">
                x77xdavid@gmail.com
              </a>{" "}
              and we will act without undue delay, as required by law. Subscription emails can also be cancelled instantly
              via the unsubscribe link in each message.
            </p>
          </Block>

          <Block title="7. Children">
            <p>This service is not directed to children under 14 and does not knowingly collect their personal data.</p>
          </Block>

          <Block title="8. Security">
            <p>
              Database access is server-side only with restricted credentials; anonymous public access is revoked (RLS).
              All traffic is encrypted over HTTPS.
            </p>
          </Block>

          <Block title="9. Data protection officer">
            <p>
              Choi Pil-kwan ·{" "}
              <a href="mailto:x77xdavid@gmail.com" className="link-ink">
                x77xdavid@gmail.com
              </a>
            </p>
          </Block>

          <Block title="10. Changes">
            <p>If this policy changes, we will post the update and its effective date on this page. Current effective date: July 9, 2026.</p>
          </Block>
        </div>
      </section>
    </SiteChrome>
  );
}

// 정책 블록 — 제목 + 본문. 한국어/영어 섹션 공통 재사용(source-policy와 동일 패턴).
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
