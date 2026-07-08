# claude-checkup

> 라이브: https://claude-checkup.vercel.app

> 내 Claude Code 사용 수준을 로컬에서 진단하고(개수·불리언만 수집, 파일 내용·이름 미수집)
> 100점 만점 점수 + 영역별 약점 + 맞춤 스킬 추천을 주는 다국어 웹앱. Next.js 15 · 16개 로케일.

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:3000 (환경변수 없으면 memory 어댑터로 동작)
```

진단 스캐너(읽기 전용, 의존성 0):

```bash
node scanner/checkup.mjs --base http://localhost:3000
```

## 저장소 어댑터

- **memory** (기본, 로컬): `lib/db/memory.ts` — 프로세스 재시작 시 휘발. 키가 없으면 자동 선택.
- **supabase** (배포): `lib/db/supabase.ts` — `NEXT_PUBLIC_SUPABASE_URL`(또는 `SUPABASE_URL`) +
  `SUPABASE_SERVICE_ROLE_KEY` 가 둘 다 있으면 자동 선택. 선택 로직은 `lib/db/select.ts`.

## 배포

Vercel + Supabase 단계별 가이드 → **[DEPLOY.md](./DEPLOY.md)**
(서버리스에서 요청 간 상태가 휘발하지 않도록 Supabase 어댑터가 필수)

## 스크린샷

<!-- 배포 후 결과 페이지 캡처를 여기에: docs/screenshot-result.png -->
_(준비 중)_
