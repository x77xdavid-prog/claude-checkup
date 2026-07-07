// 유스케이스 사전 — "하고 싶은 일"(자연어) → 추천 스킬. 결정적 데이터(LLM 호출 없음).
// skillNames는 public/catalog.json 실존 name만 담는다. 창작 금지.
//   ↳ 후보 이름은 scripts/verify-usecases.mjs로 실존 검증했고, 없는 이름은 아래에서 이미 제거됨.
//   ↳ 실존 2개 미만이던 시나리오("엑셀·데이터 정리")는 통째로 제외했다(원 요구사항 규칙).
// aliases는 소문자로 저장 → matchUsecase가 소문자 비교. skillNames 순서 = 추천 순서.

export interface Usecase {
  id: string;
  label: string;
  aliases: string[]; // 소문자
  skillNames: string[]; // catalog.json 실존 name, 추천 순서대로
  pitch: string;
}

// 각 항목: 원 후보에서 실존하지 않는 이름을 제거한 최종본.
//   제거 내역(보고용):
//   - anthropic-skills:pptx (미존재) → pptx 유지
//   - writer (미존재) → writer-memory 유지
//   - xlsx / data:analyze (미존재) → 엑셀 시나리오 실존 스킬 1개(dashboard-builder)뿐 → 시나리오 자체 제외
//   - schedule, loop (미존재) → 자동화는 hookify, github-ops 2개로 유지
//   - email-sequence (미존재) → cold-email, emails 2개로 유지
//   - claude-video (미존재) → video 1개뿐 → 영상 시나리오는 video-downloader, fal-video-edit 실존 보강해 유지
export const USECASES: Usecase[] = [
  {
    id: "presentation",
    label: "발표자료·PPT",
    aliases: ["ppt", "피피티", "파워포인트", "발표", "슬라이드", "프레젠테이션", "presentation", "pptx"],
    skillNames: ["pptx", "pptx-generator", "slides", "image", "make-pdf"],
    pitch: "슬라이드 생성·수정·읽기까지 한 번에",
  },
  {
    id: "report",
    label: "보고서·문서",
    aliases: ["보고서", "워드", "문서작성", "문서", "report", "docx", "doc"],
    skillNames: ["docx", "make-pdf", "writer-memory", "wiki"],
    pitch: "워드 문서 작성부터 PDF 변환·위키 정리까지",
  },
  {
    id: "pdf",
    label: "PDF",
    aliases: ["pdf", "피디에프"],
    skillNames: ["pdf", "make-pdf", "minimax-pdf"],
    pitch: "PDF 읽기·생성·변환",
  },
  {
    id: "scrape",
    label: "웹 크롤링·수집",
    aliases: ["크롤링", "크롤", "스크래핑", "수집", "crawl", "scrape", "scraping"],
    skillNames: ["scrape", "data-scraper-agent", "insane-search", "deep-research"],
    pitch: "웹에서 데이터 긁어와 정리·검색",
  },
  {
    id: "make-agent",
    label: "에이전트·스킬 만들기",
    aliases: ["에이전트", "스킬만들기", "스킬 만들기", "agent", "커스텀", "custom"],
    skillNames: ["skill-create", "skillify", "install-agent", "agent-sort"],
    pitch: "나만의 스킬·에이전트를 만들고 설치",
  },
  {
    id: "website",
    label: "웹사이트·랜딩",
    aliases: ["홈페이지", "웹사이트", "랜딩", "landing", "website", "웹페이지"],
    skillNames: ["frontend-design", "ui-ux-pro-max", "design-html", "landing-report"],
    pitch: "랜딩·홈페이지를 디자인부터 진단까지",
  },
  {
    id: "seo",
    label: "블로그·SEO",
    aliases: ["블로그", "seo", "검색노출", "네이버", "blog"],
    skillNames: ["seo-audit", "ai-seo", "naver-blog-marketing", "programmatic-seo"],
    pitch: "검색 노출·블로그 마케팅 자동화",
  },
  {
    id: "code-review",
    label: "코드 검사·버그",
    aliases: ["버그", "코드리뷰", "코드 리뷰", "리뷰", "검사", "bug", "review"],
    skillNames: ["code-review", "security-review", "silent-failure-hunter", "ai-slop-cleaner"],
    pitch: "코드 리뷰·보안 점검·숨은 버그 탐지",
  },
  {
    id: "automation",
    label: "자동화·반복작업",
    aliases: ["자동화", "반복", "스케줄", "매일", "automation", "automate"],
    skillNames: ["hookify", "github-ops"],
    pitch: "반복 작업을 훅·깃 연동으로 자동화",
  },
  {
    id: "email",
    label: "이메일·뉴스레터",
    aliases: ["이메일", "뉴스레터", "메일", "email", "newsletter", "mail"],
    skillNames: ["cold-email", "emails"],
    pitch: "콜드메일·뉴스레터 작성",
  },
  {
    id: "video",
    label: "영상·유튜브",
    aliases: ["유튜브", "영상", "비디오", "video", "youtube"],
    skillNames: ["video", "video-downloader", "fal-video-edit"],
    pitch: "영상 다운로드·편집·제작",
  },
  {
    id: "deploy",
    label: "배포·서버",
    aliases: ["배포", "deploy", "서버", "server", "deployment"],
    skillNames: ["ship", "deployment-patterns", "setup-deploy"],
    pitch: "배포·서버 셋업을 안전하게",
  },
  {
    id: "research",
    label: "심층 리서치",
    aliases: ["리서치", "조사", "자료조사", "research"],
    skillNames: ["deep-research", "deep-dive", "competitors"],
    pitch: "주제를 깊게 파고드는 자료 조사",
  },
];

// 순수 함수: 검색어와 부분 매치되는 유스케이스 반환(첫 매치 우선), 없으면 null.
// name/description 등 카탈로그 매칭과 별개 — 오직 label/alias 부분 매치.
// 빈 문자열·공백은 null(전체 표시 상태에서 추천 안 띄움).
export function matchUsecase(query: string): Usecase | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const uc of USECASES) {
    if (uc.label.toLowerCase().includes(q)) return uc;
    if (q.includes(uc.label.toLowerCase())) return uc;
    for (const a of uc.aliases) {
      if (a.includes(q) || q.includes(a)) return uc;
    }
  }
  return null;
}

// 실패 시 깨지는 최소 자가검증 — node --input-type=module 로 이 파일 실행 시 동작.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const eq = (got: unknown, want: unknown, msg: string) => {
    if (got !== want) throw new Error(`assert 실패: ${msg} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };
  eq(matchUsecase("ppt")?.id, "presentation", '"ppt" → 발표자료');
  eq(matchUsecase("피피티")?.id, "presentation", '"피피티" → 발표자료');
  eq(matchUsecase("크롤링")?.id, "scrape", '"크롤링" → 웹 크롤링');
  eq(matchUsecase("없는말123")?.id ?? null, null, '"없는말123" → null');
  eq(matchUsecase("")?.id ?? null, null, '빈 문자열 → null');
  console.log("usecases self-check OK");
}
