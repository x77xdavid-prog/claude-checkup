# claude-checkup — 설계 스펙 (2026-07-07, B안 풀 SaaS 승인됨)

## 1. 제품 정의

**한 줄**: 누구나 자기 Claude Code 사용 수준을 진단받고, 부족한 부분을 개선하는 SaaS.

- 무료: 진단 점수 + 영역별 리포트 + 부족 스킬 추천·설치 명령 + 일일 클로드 뉴스레터
- 유료(구독): 맞춤 개선 플랜, 주간 재진단 추적, 프리미엄 스킬 큐레이션
- 타겟: Claude Code 사용자 (한국어 우선, i18n 여지)

## 2. 결정 사항 (사용자 승인)

- **아키텍처 B안**: 풀 SaaS — Next.js + Supabase + 실결제까지 가는 로드맵. 단 오늘은 Phase 1.
- **뉴스레터**: 발송은 파일 생성 모드로 시작 (Resend 어댑터는 키 입력 시 활성).
- 포트폴리오 규칙 준수: 외부 유료 서비스 금지(무료 티어만), 파일명 영문 슬러그, Next.js는 `--webpack`.

## 3. 아키텍처

```
[방문자] → Next.js 15 (App Router, --webpack)
   /            랜딩: 가치제안 + 진단 시작(스캐너 원라이너 복사) + 구독 폼 + 프라이싱
   /result/[id] 진단 결과: 점수카드·영역 막대·몰라서/필요없음 진단·스킬 추천
   /catalog     스킬 카탈로그: 스킬 검색 + 설명 + 설치 명령 복사
   /pricing     무료 vs 구독 비교 + 결제 CTA(Phase 4 전까지 대기자 등록)
   /api/scan    POST: 스캐너 결과 수신 → 저장 → {id} 반환
   /api/subscribe POST: 이메일 등록

[스캐너 scanner/checkup.mjs]  ← 물리 제약: ~/.claude는 사용자 로컬에만 존재
   node 원라이너로 실행 → 스킬/에이전트/훅/플러그인/세션 스캔(개수·이름만, 내용 X)
   → 점수 계산(§5 루브릭) → POST /api/scan → 브라우저로 /result/{id} 오픈
   → 오프라인 폴백: 로컬 HTML 리포트 생성

[뉴스레터 newsletter/]
   crawl.mjs: HN Algolia API + r/ClaudeAI .json + claude-code GitHub 릴리스 (전부 무키 공개 API)
   digest.mjs: 상위 항목 → 한국어 요약 다이제스트 HTML → digests/YYYY-MM-DD.html
   send.mjs: MAIL_ADAPTER=file(기본)|resend. file이면 생성만, resend면 실발송
   스케줄: Phase 2에서 GitHub Actions cron 또는 /schedule 루틴

[DB 어댑터 src/lib/db/]
   interface: saveScan/getScan/addSubscriber/listSubscribers
   memory(기본, 오늘) → supabase(Phase 2 스왑). 비즈니스 로직은 인터페이스만 의존.

[결제 어댑터 src/lib/pay/]  — axpay 어댑터 패턴 재사용
   interface: createCheckout/verifyWebhook. stub(오늘) → stripe test(Phase 3) → 실결제(Phase 4)
```

## 4. 데이터 모델

```sql
scans(id uuid pk, created_at timestamptz, score_total int, categories jsonb, meta jsonb)
subscribers(email text pk, created_at timestamptz, confirmed bool default false, unsub_token uuid)
-- digests는 파일시스템(digests/*.html)으로 시작. DB 승급은 필요 시.
```

- scans.meta에는 **개수·불리언만** (스킬 이름 목록 X, 파일 내용 X — 개인정보 최소화가 셀링포인트).
- categories: `[{key, label, score, verdict: "잘씀"|"몰라서"|"불필요"}]`

## 5. 점수 루브릭 (스캐너 이식)

| 영역 | 가중치 | 측정 |
|---|---|---|
| 기본 코딩 활용 | 15 | 세션 수·프로젝트 수 |
| 커스터마이즈 | 10 | settings.json 훅 수·CLAUDE.md 존재 |
| 스킬 생태계 | 15 | 설치 스킬 수 + 다양성 |
| 에이전트 위임 | 10 | agents/ 수 |
| 모델 전략 | 5 | model 설정 여부 |
| 브라우저 검증 | 10 | playwright/browser MCP 흔적 |
| 메모리·컨텍스트 | 10 | memory/·CLAUDE.md 계층 |
| 자동화·스케줄 | 15 | 훅 수·cron/루틴 흔적 |
| 오케스트레이션 | 5 | 워크플로/팀 스킬 흔적 |
| 외부 연동 | 5 | MCP 서버 수 |

각 영역 0~100 → 가중 평균 = 총점. 영역별 판정: 낮음+가치높음="몰라서 못 씀"(개선 추천), 낮음+가치낮음="필요 없음"(무시 OK).

## 6. 보안 (vibesec 체크 반영)

- /api/scan: zod 스키마 검증, 페이로드 32KB 제한, 숫자 범위 검증, IP 기준 분당 5회 제한(메모리 레이트리밋 → P2에서 KV)
- /api/subscribe: 이메일 정규식+정규화, 허니팟 필드, 분당 3회 제한, unsub_token으로만 해지
- 시크릿: 전부 .env, 클라이언트에는 NEXT_PUBLIC_*만. 서비스롤 키는 서버 전용.
- 스캐너: 읽기 전용, 전송 전 수집 항목을 터미널에 출력하고 y/N 동의 후 전송.

## 7. Phase 계획

- **P1 (완료 2026-07-07)**: 스캐폴드 + 4페이지 + /api 2개(memory DB) + 스캐너 + 뉴스레터 크롤·다이제스트(file 모드) + 카탈로그. 이후 같은 날 추가: SEO(서버 렌더·sitemap·JSON-LD)+14카테고리, 랜딩 깔때기(가상 58점 예시 진단서+추천 엔진), 유스케이스 검색("PPT 만들기"류 일반인 질의→추천), checkup-skills 마켓플레이스 repo(설치 장벽 해소 무료 티어).
- **P2**: Supabase 연결 + Vercel 배포 + GitHub Actions cron + NEXT_PUBLIC_SITE_URL 실도메인.
- **P3**: Resend 발송(더블 옵트인·해지) + **MCP 인스톨러**(사용자 승인됨 2026-07-07: `claude mcp add checkup` 1회 후 "PPT 스킬 깔아줘"·"추천 전부 설치" 한 마디 설치. `install_bundle`은 구독 토큰 게이팅 = 유료 편의 계층. 우리 큐레이션 repo에서만 받기 — 임의 URL 설치 금지).
- **P4**: Stripe(해외)/토스페이먼츠(국내) 실결제 + 구독 게이팅 + 사업자 결정.

### 스킬별 예시 프롬프트 + 검색 데이터 루프 (2026-07-07 사용자 요청, i18n 완료 후 착수)

**A. 예시 프롬프트**: 각 스킬 카드에 "이렇게 말하세요" 예시 1개.
- 1순위: SKILL.md description의 실제 트리거 문구 추출(따옴표 안 한국어 우선, 없으면 영어) — build-catalog.mjs가 `examplePrompt` 필드 생성.
- 2순위: usecases.ts에 등장하는 핵심 스킬(~40개)은 수작업 큐레이션(lib/prompt-examples.ts).
- 3순위(폴백): 카테고리별 템플릿. 자동 생성분은 창작 티가 나지 않게 명령형 한 문장으로 제한.

**A-2. 설치 안내 교체 (2026-07-07 버그 리포트 → 실측 재설계)**: "고객 PC에서 실제 작동?" 검증 결과 — 마켓 출신 1줄 명령은 마켓 미등록 고객에게 실패, 로컬 421종은 원본 부재로 설치 불가(재배포는 라이선스 문제). 확정안:
- 마켓 출신(148종): build-catalog가 마켓 git remote URL 매핑(실측: gptaku·ponytail·thedotmack·understand-anything)으로 **작동하는 2줄**(marketplace add URL → install) 생성. claude-plugins-official은 실설치 1회 검증 후 확정.
- 로컬 421종: 정직 배지 "출처 미확인 — 원클릭 설치 불가" + 같은 카테고리 설치 가능 대안 자동 제시. 이 그룹이 향후 마켓플레이스 큐레이션 파이프라인(구독 가치).
- 우리 10종: `/plugin marketplace add x77xdavid-prog/checkup-skills` 2줄. 새 세션 실설치 스모크 1회 필요.

**B. 검색 로그 루프**: 사람들이 뭘 검색하는지 기록 → 카탈로그·유스케이스를 계속 개선.
- `POST /api/search-log` {query, matchedUsecase, resultCount} — 검색 확정 시(800ms 디바운스/Enter)만, 레이트리밋, **개인정보 없음(검색어·카운트만, IP 미저장)**. memory DB → P2 Supabase 테이블 `search_logs`.
- `scripts/search-insights.mjs`: 로그 집계 → ①결과 0건 질의 ②유스케이스 미매칭 빈발 질의 리포트 생성 → 신규 유스케이스/별칭 **후보 제안까지만** (자동 반영 금지 — 사람/클로드가 usecases.ts 갱신). /schedule 주간 루틴 대상.
- 사이트에 수집 고지 한 줄 (검색어만 익명 수집).

### 설치 장벽 결정 (2026-07-07 승인)
웹 클릭→로컬 설치는 브라우저 보안상 불가. 계층화: **무료 = A안** 공식 마켓플레이스 repo(`x77xdavid-prog/checkup-skills`, 명령 1회 복사 후 대화 설치) / **유료 = B안** MCP 인스톨러(P3). 마켓플레이스 수록 스킬은 개인 특화 제거 후 일반화 버전만.

## 8. Non-goals (지금 안 함)

- 원클릭 스킬 자동 설치 (원격 코드 실행 위험 — 명령 복사까지만)
- 계정/로그인 시스템 (P4 결제 전까지 이메일만)
- 진단 이력 대시보드, i18n, 다크모드 토글

## 9. 검증 기준 (P1 완료 정의)

- `npm run build` 그린, `npm run dev`에서 4페이지 렌더
- 스캐너를 이 PC에서 실행 → 실제 점수 산출 → API 저장 → /result/{id} 렌더까지 E2E 1회 통과
- 구독 폼 제출 → 저장 확인, 허니팟·중복 차단 동작
- 뉴스레터: crawl→digest 실행 시 오늘자 HTML 생성(실데이터)
- 콘솔 에러 0, 320px 가로 스크롤 없음

## AdSense 승인 준비 (2026-07-08 승인 — 대시보드 재설계 완료 후 착수)

목표: Publisher ID 없이도 **AdSense 승인 신청 가능** 상태 + ID 받으면 env 한 줄로 광고 활성. 사용자는 AdSense 계정·승인·ID 발급만.

- **env 게이트** `NEXT_PUBLIC_ADSENSE_ID`(ca-pub-XXXX): 없으면 광고 코드·스크립트 전부 미로드(사이트 정상), 있으면 로드. 승인 전엔 비워둠.
- **개인정보처리방침** `/[locale]/privacy` — AdSense 승인 필수. 쿠키·제3자 광고·데이터 수집(검색 로그 익명·스캔 개수만) 명시. 16개 언어. footer에 링크.
- **쿠키 동의 배너** — EU/AdSense 요구. 동의 전 광고 스크립트 로드 금지(consent-gated). 로컬스토리지 기억. 최소 구현(외부 CMP 없이), 거부 시 광고 미로드.
- **ads.txt** `public/ads.txt` — `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0` (ID는 env→빌드시 주입 또는 승인 후 수기). 승인 전엔 플레이스홀더+주석.
- **광고 슬롯** `components/AdSlot.tsx` — CLS 방지 min-height 예약. 배치: 카탈로그 in-content 1개(첫 카테고리 뒤), 결과 페이지 점수카드 아래 1개. **과다배치 금지**(스킬: 뷰어빌리티·CWV). `<ins class="adsbygoogle">` + push, 동의+ID 있을 때만.
- **승인 가이드** `ADSENSE.md` — 계정 생성→사이트 추가→ads.txt 확인→심사 대기→ID를 Vercel env에 넣고 redeploy. 정책 경고(자가클릭·클릭유도 금지) 명시.
- **정책 안전장치**: 자기광고 클릭 금지 안내, CLS 0(min-height), ads.txt 필수, 콘텐츠 충분(569종·5690프롬프트=승인 유리). 결과 페이지 광고는 noindex라도 무방(광고는 인덱싱과 무관).
- 주의: locales·layout.tsx 동시수정 → 대시보드 재설계와 **순차 실행**(충돌 방지).
