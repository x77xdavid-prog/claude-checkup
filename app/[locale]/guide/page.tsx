import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import CopyButton from "@/components/CopyButton";
import { getDict, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { alternatesFor } from "../layout";

// 가이드 — 클로드 코드 사용법 초보→고급 단일 페이지(한국어 본문).
// 출처: 스탠드얼론 "클로드-가이드.html"의 기초/중급/고급/Q&A 4개 섹션만 포팅(내용 보존, 스타일만 재적용).
// 스킬 카탈로그(977종)는 /catalog에 이미 있으므로 여기선 "가르치는 내용"만 담고, 마지막에 카탈로그로 유도.
// 정책 페이지(source-policy·privacy·terms)와 동일한 구조·토큰 사용 — 파랑 카드 CSS는 도입하지 않는다.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    title: "가이드 · Claude Code 사용법",
    description:
      "클로드 코드(Claude Code)를 완전 초보부터 고급까지 — 터미널 여는 법(Windows/Mac), 설치 확인, 핵심 파일 3종(CLAUDE.md·PROGRESS.md·MEMORY.md), 필수 명령어, 커밋·PR, 훅·MCP·나만의 스킬, 워크플로·오케스트레이션, 무인 자동화, 자주 막히는 Q&A까지 한 페이지 가이드.",
    alternates: alternatesFor(loc, "/guide"),
  };
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  const mcpConnectCmd = "claude mcp add --transport http checkup-skills https://claudecowork.co.kr/api/mcp";
  const claudeInstallCmd = "npm install -g @anthropic-ai/claude-code";
  const didItWorkPrompt = "방금 설치한 [스킬명] 스킬이 보이면, 그 스킬로 할 수 있는 일 3가지를 알려줘.";

  return (
    <SiteChrome locale={loc} dict={dict}>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">Claude Code Guide</p>
        <h1 className="font-serif text-4xl font-black text-ink sm:text-5xl">가이드</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--ink-soft)]">
          완전 초보부터 무인 자동화까지 — 클로드 코드를 제대로 부리는 법을 네 단계로 정리했습니다. 어려운 말은
          뺐고, 바로 따라 할 수 있는 것만 담았습니다.
        </p>

        {/* 처음이라면 1분 시작으로 유도 */}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--paper-2)] px-4 py-2.5 text-sm">
          <span className="text-ink">{dict.start.guidePointer}</span>
          <a href={`/${loc}/start`} className="link-ink font-medium">
            {dict.start.guidePointerLink}
          </a>
        </p>

        {/* 페이지 내 점프 내비 */}
        <nav aria-label="가이드 목차" className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="#basics" className="link-ink">🧭 기초편</a>
          <a href="#terminal" className="link-ink">🖥️ 터미널 여는 법</a>
          <a href="#did-it-work" className="link-ink">✅ 설치 확인</a>
          <a href="#no-terminal" className="link-ink">🧷 터미널 없이</a>
          <a href="#intermediate" className="link-ink">🎓 중급편</a>
          <a href="#advanced" className="link-ink">🏔️ 고급편</a>
          <a href="#qna" className="link-ink">❓ Q&amp;A</a>
        </nav>

        {/* ───────────── 기초편 ───────────── */}
        <Tier
          id="basics"
          eyebrow="완전 초보용 · 어려운 말 없이"
          title="🧭 기초편 — 이것부터"
          intro={
            <>
              에이전트·스킬을 쓰기 전에, 클로드를 똑똑하게 만드는 <strong>파일 3개</strong>와{" "}
              <strong>필수 명령어</strong>부터. 이 3개 파일이 &ldquo;클로드가 나를 기억하고, 내 규칙대로 일하게&rdquo;
              만듭니다.
            </>
          }
        >
          <Sub id="terminal" title="🖥️ 터미널 여는 법" note="30초 · Windows / Mac" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            터미널은 <strong>글자로 명령하는 창</strong>이고, 클로드 코드는 그 안에서 돌아갑니다. 여는 법만 알면
            절반은 끝난 겁니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="Windows">
              <strong>시작 버튼</strong>(또는 ⊞ Win 키) 누르고 <strong>&ldquo;터미널&rdquo;</strong> 검색 →{" "}
              <strong>터미널</strong>(또는 PowerShell) 클릭. 단축키는 <code>Win+R</code> → <code>wt</code> 입력 →
              Enter.
            </Row>
            <Row term="Mac">
              <code>Cmd+Space</code>(스포트라이트) → <strong>&ldquo;터미널&rdquo;</strong>(terminal) 입력 → Enter.
            </Row>
            <Row term="VSCode 쓴다면">
              <code>Ctrl+`</code>(백틱) 하나로 <strong>내장 터미널</strong>이 열립니다. 따로 안 열어도 됩니다.
            </Row>
            <Row term="열렸으면">
              <code>claude</code> 치고 Enter — 클로드 코드가 시작됩니다. &ldquo;명령을 찾을 수 없다&rdquo;고 나오면
              아래 설치부터.
            </Row>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
            <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{claudeInstallCmd}</code>
            <CopyButton
              text={claudeInstallCmd}
              label={dict.scanner.copy}
              copiedLabel={dict.scanner.copied}
              className="shrink-0 !px-2 !py-1 !text-xs"
              track={{ event: "install_copy", name: "claude-code" }}
            />
          </div>
          <p className="mt-2 leading-relaxed text-[var(--ink-soft)]">
            💡 설치엔 <strong>Node.js</strong>가 먼저 필요합니다(nodejs.org에서 LTS 설치). 설치 후 터미널을{" "}
            <strong>껐다 다시 열고</strong> <code>claude</code>. 터미널 없이 시작하고 싶다면{" "}
            <a href={`/${loc}/prompts`} className="link-ink">
              프롬프트 라이브러리
            </a>
            를 claude.ai에서 먼저 써보세요.
          </p>

          <Sub title="핵심 파일 3종" note="매번 자동 적용" />
          <Stack title="📗 CLAUDE.md — 규칙서">
            <p>
              클로드가 <strong>매번 자동으로 읽는</strong> 프로젝트 규칙서. 여기 적은 대로 항상 따릅니다.
              &ldquo;이 프로젝트에선 이렇게 해줘&rdquo;를 적는 곳.
            </p>
            <p>
              예) <em>&ldquo;테스트 먼저 써줘 · 커밋 메시지는 한국어 · 이 폴더는 건드리지 마 · 배포 전 꼭 물어봐&rdquo;</em>
            </p>
            <p>💡 짧고 <strong>명령형</strong>으로. 너무 길면 힘이 빠집니다. 프로젝트 폴더 맨 위에 둡니다.</p>
          </Stack>
          <Stack title="📘 PROGRESS.md — 진행 상태">
            <p>
              지금 <strong>무슨 작업 중인지</strong> 저장하는 곳. 대화가 끊기거나 <code>/compact</code>로 압축돼도
              여기 있으면 그대로 이어갑니다.
            </p>
            <p>4블록: <strong>현재 상태 · 내린 결정 · 다음 할 일 3개 · 주의점</strong></p>
            <p>
              💡 세션 시작 때 맨 먼저 읽고, 작업 단계가 끝날 때마다 갱신. &ldquo;상태는 대화가 아니라 파일에 둔다.&rdquo;
            </p>
          </Stack>
          <Stack title="📙 MEMORY.md — 영구 기억">
            <p>
              세션이 바뀌어도 <strong>기억할 사실</strong>의 목록. <strong>한 줄 = 한 사실.</strong>
            </p>
            <p>
              예) <em>&ldquo;내 이메일은 ~ · 이 파일은 두 곳이라 저장 후 동기화 · main에 push하면 자동 배포&rdquo;</em>
            </p>
            <p>💡 코드에 이미 있는 건 넣지 말 것(중복). &ldquo;왜 그런지&rdquo;가 중요한 것만 적습니다.</p>
          </Stack>

          <Sub title="⌨️ 필수 명령어" note="6개만 알면 충분" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            채팅창에 <code>/</code>를 치면 명령. 이 6개만 알면 대화를 안 끊기게 오래 끌고 갈 수 있습니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term={<code>/context</code>}>
              지금 대화가 얼마나 찼는지 %로 봅니다. 꽉 찰수록 느려지고 비싸집니다 —{" "}
              <strong>80% 넘으면 압축 신호.</strong>
            </Row>
            <Row term={<code>/compact</code>}>
              긴 대화를 <strong>요약해 압축</strong>. 맥락은 유지하며 공간 확보. 작업 하나 끝난 자연스러운 구간에서.
              <em> &ldquo;요약하고 PROGRESS.md 갱신 후 이어가&rdquo;</em>처럼 지시할 수 있습니다.
            </Row>
            <Row term={<code>/clear</code>}>
              대화를 <strong>완전히 비우고</strong> 새로 시작(압축과 달리 맥락 안 남김). 전혀 다른 작업 시작할 때.
            </Row>
            <Row term={<code>/model</code>}>
              쓸 모델 바꾸기. <strong>어려운 설계·분석 = Opus</strong>, 표준 작업 = Sonnet, 단순 잡무 = Haiku.
            </Row>
            <Row term={<code>Esc</code>}>
              실행 중인 걸 <strong>즉시 중단</strong>. 엉뚱하게 가고 있으면 누르고 다시 지시합니다.
            </Row>
            <Row term={<code>/help</code>}>전체 명령 목록 보기. 기억 안 나면 여기서.</Row>
          </dl>

          <Sub title="⭐ 처음엔 이 스킬만" note="목적별" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            카탈로그가 방대하니, 처음엔 목적별로 이것만 기억하세요. (자세한 건 카탈로그에서 검색)
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="복잡한 일 자동으로">
              <code>autopilot</code> — 계획·실행·검증까지 알아서. 큰 작업 통째로 맡길 때.
            </Row>
            <Row term="코드 점검">
              <code>code-reviewer</code>(작성 직후) · <code>security-reviewer</code>(커밋 전 보안).
              &ldquo;이 코드 리뷰해줘&rdquo;로 호출.
            </Row>
            <Row term="리서치·조사">
              <code>deep-research</code> · <code>insane-search</code>(막힌 사이트도 뚫어 읽음).
            </Row>
            <Row term="토큰 절약">
              <code>caveman</code> · <code>token-diet</code> — 출력 짧게, 비용 절감.
            </Row>
            <Row term="단순하게 정리">
              <code>ponytail</code>(과잉설계 제거) · <code>deslop</code>(AI 군더더기 청소).
            </Row>
          </dl>

          <Sub id="did-it-work" title="✅ 설치가 됐는지 확인하는 법" note="did it work? · 30초" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            설치 명령을 실행했는데 <strong>된 건지 모르겠다</strong> — 가장 흔한 막힘입니다. 경로별 30초 확인법:
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="플러그인·마켓 설치">
              클로드 코드에서 <code>/plugin</code> → <strong>Installed</strong> 목록에 이름이 있으면 성공.
            </Row>
            <Row term="폴더에 직접 설치">
              <code>~/.claude/skills</code>에 넣었다면 클로드 코드 <strong>재시작</strong> 후 <code>/</code>를 쳐서
              목록에 뜨는지 확인.
            </Row>
            <Row term="만능 확인 문장">
              어느 경로든 아래 문장을 붙여넣고 <strong>[스킬명]만 바꾸면</strong> 됩니다. 스킬을 알아보고 답하면 성공:
            </Row>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
            <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{didItWorkPrompt}</code>
            <CopyButton
              text={didItWorkPrompt}
              label={dict.scanner.copy}
              copiedLabel={dict.scanner.copied}
              className="shrink-0 !px-2 !py-1 !text-xs"
              track={{ event: "prompt_copy", name: "did-it-work" }}
            />
          </div>
          <p className="mt-2 leading-relaxed text-[var(--ink-soft)]">
            &ldquo;그런 스킬 없는데요&rdquo;라고 하면 ① 재시작 ② 이름 오타 확인 ③{" "}
            <a href="#qna" className="link-ink">
              Q&amp;A
            </a>
            의 &ldquo;스킬을 썼는데 아무 변화가 없어요&rdquo; 순서로. 터미널 없이 <strong>claude.ai</strong>에 스킬
            파일을 올린 경우도 같은 문장으로 확인합니다.
          </p>

          <Sub id="no-terminal" title="🧷 터미널 없이 스킬 쓰기" note="claude.ai 업로드" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            터미널이 아직 부담스러우면 건너뛰어도 됩니다 — <strong>claude.ai</strong>(웹·앱)에 스킬 zip 파일을
            올리면 대화에서 바로 쓸 수 있습니다. 3단계:
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="1. zip 내려받기">
              필요한 것만 받으세요:{" "}
              <a href="/skills/first-setup.zip" className="link-ink" download>
                first-setup.zip
              </a>
              (클로드 코드 첫 설치를 한 단계씩 완주) ·{" "}
              <a href="/skills/ko-writer.zip" className="link-ink" download>
                ko-writer.zip
              </a>
              (번역투 없는 자연스러운 한국어 글쓰기) ·{" "}
              <a href="/skills/excel-helper.zip" className="link-ink" download>
                excel-helper.zip
              </a>
              (엑셀·CSV 정리를 원본 보존 원칙으로) ·{" "}
              <a href="/skills/did-it-work.zip" className="link-ink" download>
                did-it-work.zip
              </a>
              (설치가 됐는지 증거로 판정) ·{" "}
              <a href="/skills/ppt-draft.zip" className="link-ink" download>
                ppt-draft.zip
              </a>
              (발표자료 초안을 목차 승인부터 발표 노트까지) ·{" "}
              <a href="/skills/meeting-actions.zip" className="link-ink" download>
                meeting-actions.zip
              </a>
              (회의록을 결정·액션아이템 표로, 날조 금지 원칙) ·{" "}
              <a href="/skills/naver-seo-check.zip" className="link-ink" download>
                naver-seo-check.zip
              </a>
              (네이버 SEO를 3판정 체크리스트로 진단) ·{" "}
              <a href="/skills/youtube-script.zip" className="link-ink" download>
                youtube-script.zip
              </a>
              (유튜브 대본을 훅부터 CTA까지 구조로) ·{" "}
              <a href="/skills/no-git-backup.zip" className="link-ink" download>
                no-git-backup.zip
              </a>
              (git 없이 백업 습관, 복원 리허설까지) ·{" "}
              <a href="/skills/resume-coach.zip" className="link-ink" download>
                resume-coach.zip
              </a>
              (이력서·자소서를 지어내지 않고 사실만으로 개선) ·{" "}
              <a href="/skills/image-batch.zip" className="link-ink" download>
                image-batch.zip
              </a>
              (이미지 수백 장을 원본 보존하며 일괄 변환·압축) ·{" "}
              <a href="/skills/contract-check.zip" className="link-ink" download>
                contract-check.zip
              </a>
              (계약서를 확인 질문 목록으로, 법률 자문 아님 고지) ·{" "}
              <a href="/skills/budget-log.zip" className="link-ink" download>
                budget-log.zip
              </a>
              (가계부를 파일 기록·파이썬 검산으로)
            </Row>
            <Row term="2. claude.ai에 올리기">
              claude.ai <strong>설정 → 기능(Capabilities) → 스킬</strong>에서 zip을 업로드합니다. 스킬 업로드는{" "}
              <strong>유료 플랜 기능</strong>입니다. (무료 플랜이라면 zip 안의 SKILL.md를 열어 내용을 대화에
              붙여넣어도 비슷한 효과를 냅니다)
            </Row>
            <Row term="3. 대화에서 부르기">
              &ldquo;<em>first-setup 스킬로 설치 도와줘</em>&rdquo;처럼 <strong>스킬명을 언급</strong>하면 그 스킬
              방식대로 일합니다. 적용됐는지 애매하면 위의 만능 확인 문장으로 확인하세요.
            </Row>
          </dl>

          <Sub title="📄 일관성 있는 보고서" note="방법 + 스킬" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            &ldquo;매번 같은 형식&rdquo;의 핵심은 스킬 하나가 아니라 <strong>틀을 규칙으로 박아두는 것</strong>입니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="1. 형식 고정">
              좋은 보고서를 <strong>한 번</strong> 만들고 → 그 형식(제목·항목 순서·말투)을 <code>CLAUDE.md</code>에
              규칙으로 적거나 나만의 스킬로 만듭니다(<code>skillify</code> / <code>skill-create</code>). 그러면 매번 같은 틀.
            </Row>
            <Row term="2. 문서 생성">
              <code>document-generate</code> · <code>make-pdf</code> · 오피스 <code>docx</code> · <code>pptx</code> ·{" "}
              <code>xlsx</code> — Word/PPT/엑셀/PDF로 바로 뽑기.
            </Row>
            <Row term="3. 정기 보고">
              <code>standup</code>(일일) · <code>weekly-digests</code>(주간) · <code>retro</code>(회고) — 반복 보고를 같은 틀로.
            </Row>
            <Row term="핵심">
              상태를 파일에 두면 사람이 바뀌어도 일관됩니다. <code>PROGRESS.md</code>(진행)·<code>logs/날짜.md</code>(회고)처럼
              보고서도 <strong>틀을 파일에 두는 것</strong>이 원리.
            </Row>
          </dl>
        </Tier>

        {/* ───────────── 중급편 ───────────── */}
        <Tier
          id="intermediate"
          eyebrow="자동화 · 확장 · 오케스트레이션"
          title="🎓 중급편 — 한 단계 위"
          intro={
            <>
              기초가 익었으면 이제 <strong>반복을 자동화</strong>하고, <strong>도구를 붙이고</strong>,{" "}
              <strong>여러 작업을 동시에</strong> 돌리는 단계. 여기부터가 진짜 생산성입니다.
            </>
          }
        >
          <Sub title="핵심 도구 3가지" note="자동화·확장" />
          <Stack title="⚙️ 훅(Hooks) — 자동화">
            <p>
              특정 순간에 <strong>명령을 자동 실행</strong>. &ldquo;저장하면 자동 포맷·린트&rdquo;,
              &ldquo;끝날 때 자동 빌드 검증&rdquo;처럼 사람이 안 해도 돌아갑니다.
            </p>
            <p>
              <strong>PreToolUse</strong>(실행 전 검사·차단) · <strong>PostToolUse</strong>(수정 후 포맷/타입체크) ·{" "}
              <strong>Stop</strong>(세션 끝 최종 확인)
            </p>
            <p>
              💡 <code>settings.json</code>에 설정. &ldquo;매번 X 해줘&rdquo;는 기억이 아니라 <strong>훅</strong>으로
              박아야 진짜 자동입니다.
            </p>
          </Stack>
          <Stack title="🔌 MCP — 외부 도구 붙이기">
            <p>
              클로드에 <strong>새 능력을 꽂는</strong> 표준. GitHub·Playwright·DB·내 서버를 대화 안에서 직접 쓰게 됩니다.
            </p>
            <p>
              로컬 <code>claude mcp add 이름 -- node 서버.mjs</code> · 원격{" "}
              <code>claude mcp add --transport http 이름 URL</code>
            </p>
            <p>
              ✅ <strong>이 사이트를 바로 연결</strong> — 붙이면 에이전트가 <strong>전체 카탈로그를 검색</strong>하고 검증된{" "}
              <strong>설치 명령</strong>을 바로 받습니다(읽기 전용, 설치는 직접 확인 후 실행).
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
              <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{mcpConnectCmd}</code>
              <CopyButton
                text={mcpConnectCmd}
                label={dict.scanner.copy}
                copiedLabel={dict.scanner.copied}
                className="shrink-0 !px-2 !py-1 !text-xs"
                track={{ event: "mcp_copy" }}
              />
            </div>
            <p>
              💡 CLI는 사람이 치는 것, MCP는 <strong>에이전트가 스스로 호출</strong>하는 것. 한 번 붙이면 알아서 씁니다.
            </p>
          </Stack>
          <Stack title="🧩 나만의 스킬 만들기">
            <p>
              반복하는 작업을 <strong>슬래시 명령 하나로</strong>. &ldquo;매번 이렇게 해줘&rdquo;를 스킬로 박으면
              다음부턴 <code>/내스킬</code>.
            </p>
            <p>
              <code>skillify</code> / <code>skill-create</code> — 지금까지의 작업 패턴을 스킬 파일로 뽑아줍니다.
            </p>
            <p>💡 보고서 형식·배포 절차·리뷰 체크리스트처럼 <strong>반복 + 일관성</strong>이 필요한 것에 최적.</p>
          </Stack>

          <Sub title="🚀 워크플로 — 큰 작업 통째로" note="OMC Tier-0" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            여러 단계를 알아서 계획·실행·검증. 키워드만 쓰면 발동합니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term={<code>autopilot</code>}>
              기능 하나를 계획→구현→리뷰→검증까지 자동. &ldquo;큰 거 하나 맡기고 싶을 때&rdquo; 기본값.
            </Row>
            <Row term={<code>ultrawork</code>}>
              <span className="text-[var(--ink-faint)]">(ulw)</span> 멈추지 않고 끝까지 밀어붙이는 고강도 모드.
              목표가 명확할 때.
            </Row>
            <Row term={<code>ralph</code>}>
              &ldquo;바위는 멈추지 않는다&rdquo; — 완료·검증까지 반복 루프. 지루한 대량 작업에.
            </Row>
            <Row term={<code>team</code>}>여러 전문 에이전트를 팀으로 병렬 실행. 큰 프로젝트 분업.</Row>
            <Row term={<code>ralplan</code>}>계획을 먼저 세우고 루프 실행. 불확실한 작업은 계획부터.</Row>
          </dl>

          <Sub title="🧵 병렬 · 백그라운드 · 플랜" note="속도·품질" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            독립 작업은 동시에, 오래 걸리는 건 뒤에서, 복잡한 건 계획 먼저.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="병렬 위임">
              서로 무관한 일은 여러 에이전트에 <strong>동시</strong>에. &ldquo;보안 리뷰·성능 리뷰·타입체크 동시에 돌려&rdquo;.
            </Row>
            <Row term="백그라운드">
              빌드·테스트처럼 오래 걸리는 건 뒤에서 돌리고 <strong>다른 일 계속</strong>. 끝나면 알림.
            </Row>
            <Row term="플랜 모드">
              코드 건드리기 전에 <strong>계획부터</strong> 세우고 승인받기(<code>Shift+Tab</code>로 전환). 큰 변경 전 필수.
            </Row>
            <Row term="ultrathink">
              &ldquo;깊게 생각해&rdquo; 신호 — 어려운 설계·근본원인은 이 키워드로 추론량을 늘립니다.
            </Row>
          </dl>

          <Sub title="🔧 설정 · 권한 · 모델" note="settings.json" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            클로드가 얼마나 알아서 하게 할지, 어떤 두뇌를 쓸지 조절합니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="권한 모드">
              매번 물어보기 ↔ 자동 수락. <strong>믿을 만한 계획엔 자동 수락</strong>, 탐색적일 땐 물어보게. (위험한{" "}
              <code>--dangerously-skip</code>는 쓰지 말 것)
            </Row>
            <Row term="모델 라우팅">
              어려운 설계·분석 = <strong>Opus/Fable</strong>, 표준 = Sonnet, 잡무 = <strong>Haiku</strong>(싸고 빠름).
              잡무까지 Opus면 낭비.
            </Row>
            <Row term="allowedTools">
              자주 쓰는 안전한 명령은 미리 허용해 <strong>물어보는 횟수</strong>를 줄입니다(<code>settings.json</code>).
            </Row>
            <Row term="킬 스위치">
              자동화가 과하면 <code>DISABLE_OMC</code> 등으로 끕니다. 즉시 중단 <code>Esc</code>는 기초편 참고.
            </Row>
          </dl>

          <Sub title="🔀 커밋 · PR — 깃 작업 시키기" note="/create-pr" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            코드를 <code>main</code>에 바로 넣지 않고 &ldquo;이 변경 검토해줘&rdquo;로 올리는 게{" "}
            <strong>PR(풀 리퀘스트)</strong>. 커밋·푸시·PR 생성을 클로드에게 통째로 맡길 수 있습니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="커밋 = 저장점">
              변경을 <strong>의미 단위로 묶어</strong> 기록. &ldquo;커밋해줘&rdquo; 또는 메시지까지{" "}
              &ldquo;<em>feat: 로그인 추가로 커밋해줘</em>&rdquo;. 되돌리기·리뷰의 기준점이 됩니다.
            </Row>
            <Row term="푸시 = 원격 반영">
              로컬 커밋을 GitHub에 올리기. <strong>운영 중 repo는 push = 자동 재배포</strong>일 수 있으니 확인부터(Q&amp;A 참고).
            </Row>
            <Row term={<code>/create-pr</code>}>
              브랜치 생성 → 커밋 → 푸시 → <strong>PR 생성</strong>까지 한 번에. 자연어로 &ldquo;<em>PR 올려줘</em>&rdquo;도 같은 뜻.{" "}
              <span className="text-[var(--ink-faint)]">(환경 따라 명령 이름이 다르면 그냥 &ldquo;PR 만들어줘&rdquo;)</span>
            </Row>
            <Row term="브랜치 먼저">
              <code>main</code>에선 PR을 못 만듭니다 → 클로드가 <strong>피처 브랜치</strong>를 먼저 만들어 그 위에 올립니다. 이게 정상.
            </Row>
            <Row term="초안(draft) PR">
              바로 병합용이 아니라 <strong>검토용 초안</strong>으로 올리는 게 안전. 본문엔 <strong>무엇을·왜·리뷰 포인트</strong>를 적게 합니다.
            </Row>
            <Row term={<code>ship</code>}>
              테스트·빌드까지 돌리고 PR을 올리는 <strong>배포 워크플로</strong> 스킬. &ldquo;<em>ship</em>&rdquo;·&ldquo;배포해줘&rdquo;로 발동.
            </Row>
          </dl>
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            💡 전제: <code>gh</code>(GitHub CLI) 로그인 + GitHub 저장소. 기본 브랜치(<code>main</code>)에 직접 푸시하지 말고{" "}
            <strong>PR로 검토</strong>받는 습관이 사고를 막습니다.
          </p>
        </Tier>

        {/* ───────────── 고급편 ───────────── */}
        <Tier
          id="advanced"
          eyebrow="오케스트레이션 · 자동화 파이프라인"
          title="🏔️ 고급편 — 직접 짜고, 무인으로 돌린다"
          intro={
            <>
              중급까지가 &ldquo;주어진 걸 잘 쓰기&rdquo;라면, 고급은 <strong>내 워크플로를 직접 설계</strong>하고{" "}
              <strong>사람 없이도 돌아가게</strong> 만드는 단계. 여기서부터 클로드가 도구가 아니라 시스템이 됩니다.
            </>
          }
        >
          <Sub title="핵심 역량 3가지" note="설계·무인화" />
          <Stack title="🎛️ 워크플로 직접 설계">
            <p>
              여러 에이전트를 <strong>결정적으로</strong> 팬아웃·검증. 코드로 흐름을 짭니다: <code>pipeline</code>(단계별)·
              <code>parallel</code>(동시)·<code>agent()</code>(위임).
            </p>
            <p>
              패턴: <strong>적대적 검증</strong>(N명이 반박 시도) · <strong>심사 패널</strong>(여러 안 점수화) ·{" "}
              <strong>완료까지 루프</strong>(빈 결과 K번까지).
            </p>
            <p>
              💡 <code>ultracode</code> = 모든 작업을 워크플로로. 토큰 아끼지 말고 <strong>가장 철저한 답</strong>이
              목표일 때.
            </p>
          </Stack>
          <Stack title="🛰️ 원격 · 예약 에이전트">
            <p>
              에이전트를 <strong>클라우드에서</strong> 돌리거나 <strong>정해진 시각에</strong> 자동 실행. 내 PC를 안 켜도
              돕니다.
            </p>
            <p>
              <code>/schedule</code> — cron 반복 에이전트(routine). <code>/loop</code> — 주기 반복. 원격 격리 실행도
              가능.
            </p>
            <p>
              💡 &ldquo;매일 아침 새 스킬 스캔해 요약&rdquo;, &ldquo;1시간마다 배포 확인&rdquo;처럼{" "}
              <strong>무인 반복</strong>에.
            </p>
          </Stack>
          <Stack title="🧑‍🔧 커스텀 서브에이전트">
            <p>
              나만의 전문 에이전트를 <strong>직접 정의</strong>. <code>.claude/agents/이름.md</code>에 역할·모델·쓸
              도구를 적으면 끝.
            </p>
            <p>
              frontmatter: <code>model</code>(opus/haiku…) · <code>tools</code>(허용 도구) ·{" "}
              <code>isolation: worktree</code>(격리 작업공간).
            </p>
            <p>💡 반복되는 전문 역할(예: &ldquo;우리 결제 규칙 리뷰어&rdquo;)을 박아두면 팀원처럼 부릅니다.</p>
          </Stack>

          <Sub title="🔁 CI · 헤드리스 자동화" note="사람 없이" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            대화 밖에서 — 스크립트·CI·서버에서 클로드를 프로그램처럼 호출합니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="헤드리스">
              <code>claude -p &quot;프롬프트&quot;</code> — 창 없이 한 번 실행하고 결과만. 스크립트·cron에서 호출.
            </Row>
            <Row term="GitHub Actions">
              PR 열리면 자동 리뷰·수정, 이슈에 답변. 워크플로에 클로드를 한 단계로.
            </Row>
            <Row term="Agent SDK">
              내 앱·서버 코드에서 클로드 에이전트를 직접 임베드(TS/Python). 제품에 AI 기능 넣을 때.
            </Row>
            <Row term="MCP 서버 배포">
              내 데이터·도구를 MCP로 공개 → 누구나 <code>claude mcp add</code>로 연결.
            </Row>
          </dl>

          <Sub title="🧠 컨텍스트 무중단 — 오래 끌기" note="끊기지 않게" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            긴 프로젝트를 압축·재시작에도 무손실로. &ldquo;상태는 대화가 아니라 파일에.&rdquo;
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="단계로 쪼개기">
              각 단계 산출물 = <strong>코드 + 갱신된 문서</strong>. 단계 사이엔 컨텍스트를 비워도 무손실.
            </Row>
            <Row term="경로만 주기">
              큰 파일·긴 로그는 <strong>통째로 넣지 말고</strong> 경로만 → 필요할 때 읽게. 출력도 파일로 빼기.
            </Row>
            <Row term="서브에이전트 위임">
              독립 하위작업은 에이전트에 맡기고 <strong>결과만</strong> 받습니다 → 메인 컨텍스트 경량 유지.
            </Row>
            <Row term="압축 타이밍">
              70~80% 차면 <strong>자연스러운 구간</strong>에서 <code>/compact</code>. 프롬프트 캐시는 5분 — 이어서 할
              거면 텀을 짧게.
            </Row>
          </dl>

          <Sub title="💰 토큰 예산 · 라우팅 심화" note="비용·품질 저울" />
          <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
            얼마나 깊게 팔지를 돈으로 조절. 깊이와 비용은 저울입니다.
          </p>
          <dl className="mt-3 space-y-3">
            <Row term="예산 지시">
              &ldquo;<code>+500k</code>&rdquo;처럼 이번 턴 토큰 목표를 주면 워크플로가 그만큼{" "}
              <strong>깊이·병렬을 자동 확장</strong>.
            </Row>
            <Row term="모델 티어">
              잡무는 Haiku(3배 저렴)·표준 Sonnet·최고 난도만 Opus/Fable. <strong>에이전트별로 다르게</strong> 지정 가능.
            </Row>
            <Row term="캐시 활용">
              같은 컨텍스트 재사용은 <strong>프롬프트 캐시</strong>로 싸집니다. 5분 TTL — 이어서 할 거면 텀을 짧게.
            </Row>
            <Row term="절약 스킬">
              <code>caveman</code>·<code>token-diet</code>로 출력 자체를 줄이기. 긴 세션에 누적 효과 큼.
            </Row>
          </dl>
        </Tier>

        {/* ───────────── Q&A ───────────── */}
        <Tier
          id="qna"
          eyebrow="문제 → 해결"
          title="❓ 자주 막히는 것 (Q&A)"
          intro={
            <>
              처음에 흔히 부딪히는 문제들. 대부분 <strong>인코딩 · 맥락 · 재시작</strong> 세 가지로 풀립니다.
            </>
          }
        >
          <Sub title="표시 · 설치 문제" note="4" />
          <Stack title="SKILL.md 글자가 깨져 보여요">
            <p>
              <strong>인코딩 문제.</strong> 파일은 UTF-8인데 프로그램이 다른 인코딩으로 여는 것.{" "}
              <strong>VSCode·옵시디언</strong>으로 열거나 저장할 때 &ldquo;UTF-8&rdquo; 지정. 윈도우 기본 메모장은
              피하세요.
            </p>
          </Stack>
          <Stack title="스킬을 썼는데 아무 변화가 없어요">
            <p>
              ① 스킬명 오타·미설치 → <code>/help</code>로 목록 확인 · ② <code>/</code>로 호출했는지 · ③ 새로 넣은
              스킬은 <strong>Claude Code 재시작</strong> 후 잡힘 · ④ 조언형 스킬은 &ldquo;그대로{" "}
              <strong>코드도 고쳐줘</strong>&rdquo;까지 말해야 파일이 바뀝니다. 설치 직후라면{" "}
              <a href="#did-it-work" className="link-ink">
                설치 확인법
              </a>
              부터.
            </p>
          </Stack>
          <Stack title="MCP·에이전트가 목록에 안 떠요">
            <p>
              설치·설정(<code>claude mcp add</code>, <code>.claude/agents/</code>) 후 <strong>재시작</strong> 필요.
              연결 중이면 잠시 뒤 다시.
            </p>
          </Stack>
          <Stack title="한글·공백 경로에서 오류나요">
            <p>
              경로에 공백·한글이 있으면 <strong>따옴표로 감싸기</strong>: <code>&quot;D:/프로젝트/내 폴더/파일&quot;</code>.
            </p>
          </Stack>

          <Sub title="응답 · 품질 문제" note="4" />
          <Stack title="물었는데 반응이 별로예요">
            <p>
              <strong>맥락이 부족한 것.</strong> &ldquo;이 파일 고쳐줘&rdquo;보다 <strong>경로·목표·제약</strong>을
              구체적으로: &ldquo;이 함수가 X일 때 Y 에러 나는데 Z 방식으로 고쳐줘.&rdquo; 큰 일은{" "}
              <strong>Plan 모드</strong>로 계획부터.
            </p>
          </Stack>
          <Stack title="엉뚱한 방향으로 가요">
            <p>
              <code>Esc</code>로 <strong>즉시 중단</strong> → 다시 구체적으로. 되돌리려면 변경 전 상태를 말하거나
              git으로 복구. 큰 변경 전엔 Plan 모드로 먼저 검토.
            </p>
          </Stack>
          <Stack title="점점 느려지고 비싸져요">
            <p>
              대화가 꽉 찬 것. <code>/context</code>로 확인 → 80% 넘으면 <code>/compact</code>. 단순 잡무는{" "}
              <code>/model</code>로 <strong>Haiku</strong>.
            </p>
          </Stack>
          <Stack title="대화가 끊기면 이어가질 못해요">
            <p>
              <strong>상태를 파일에.</strong> <code>PROGRESS.md</code>에 현재 상태·다음 할 일을 적어두면 압축·재시작해도
              이어감(기초편 참고).
            </p>
          </Stack>

          <Sub title="권한 · 배포 문제" note="2" />
          <Stack title="자꾸 권한을 물어봐요">
            <p>
              신뢰하는 명령은 <code>settings.json</code>의 <strong>allowedTools</strong>에 허용, 또는 믿을 만한 계획엔
              자동 수락. (위험한 <code>--dangerously-skip</code>은 금지)
            </p>
          </Stack>
          <Stack title="커밋·푸시했는데 사이트가 이상해요">
            <p>
              <strong>운영 중 repo는 push = 자동 재배포.</strong> 배포 전 빌드·테스트 확인, 실서비스는 변경 전 백업.
              충돌은 먼저 해결하고 푸시.
            </p>
          </Stack>
        </Tier>

        {/* ───────────── 카탈로그 유도 CTA ───────────── */}
        <div className="mt-14 border-t border-[var(--line-strong)] pt-10">
          <Block title="이제 스킬을 둘러보세요">
            <p>
              가이드를 읽었다면 다음은 실전입니다. 용도별로 정리한 스킬·에이전트{" "}
              <a href={`/${loc}/catalog`} className="link-ink">
                스킬 카탈로그
              </a>
              에서 지금 필요한 것을 찾아 설치 명령을 복사하세요.
            </p>
          </Block>
        </div>
      </section>
    </SiteChrome>
  );
}

// 대단원(기초/중급/고급/Q&A) — 정책 페이지의 KO/EN 구분선 패턴을 그대로 사용(구분선 + 아이브로 + 큰 h2 + 본문).
function Tier({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24 border-t border-[var(--line-strong)] pt-10">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{eyebrow}</p>
      <h2 className="font-serif text-3xl font-black text-ink">{title}</h2>
      <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">{intro}</p>
      {children}
    </section>
  );
}

// 소단원 제목(h3) + 선택적 우측 라벨. id를 주면 페이지 내 앵커(#terminal 등)로 점프 가능.
function Sub({ title, note, id }: { title: string; note?: string; id?: string }) {
  return (
    <h3 id={id} className="mt-8 flex flex-wrap items-baseline gap-x-2 scroll-mt-24 font-serif text-xl font-bold text-ink">
      <span>{title}</span>
      {note ? (
        <span className="font-mono text-[11px] font-normal uppercase tracking-wider text-[var(--ink-faint)]">
          {note}
        </span>
      ) : null}
    </h3>
  );
}

// 용어 → 설명 2열 행(명령어·스킬·설정 목록). term은 <code> 또는 라벨.
function Row({ term, children }: { term: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[minmax(0,9.5rem)_1fr] sm:gap-4">
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="text-[var(--ink-soft)]">{children}</dd>
    </div>
  );
}

// 제목 위, 본문 아래로 쌓는 블록(개념 3종·Q&A 문답).
function Stack({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-serif text-base font-bold text-ink">{title}</p>
      <div className="mt-1 space-y-1 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </div>
  );
}

// 정책 블록 — 제목 h2 + 본문. source-policy·privacy·terms와 동일 패턴(마무리 CTA에 사용).
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
