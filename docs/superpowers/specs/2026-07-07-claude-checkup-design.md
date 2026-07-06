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

- **P1 (오늘)**: 스캐폴드 + 4페이지 + /api 2개(memory DB) + 스캐너 + 뉴스레터 크롤·다이제스트(file 모드) + 카탈로그 데이터 생성 스크립트. `npm run build` 그린 + Playwright 스모크.
- **P2**: Supabase 프로젝트 연결(마이그레이션 SQL 동봉) + Vercel 배포 + GitHub Actions cron(다이제스트 커밋).
- **P3**: Resend 발송 활성 + 확인메일(더블 옵트인) + 해지 링크.
- **P4**: Stripe(해외)/토스페이먼츠(국내) 실결제 + 구독 게이팅 + 사업자 결정.

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
