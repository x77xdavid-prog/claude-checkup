# 배포 가이드 (Vercel + Supabase)

claude-checkup을 Vercel에 올리는 정확한 순서. 각 단계에 **왜 필요한지**를 한 줄로 붙였다.
전체 소요: 약 15분. 코드 수정 없이 이 문서만 따라가면 된다.

> 핵심 이유: 스캐너가 `POST /api/scan` 으로 결과를 저장하고 사용자는 `GET /result/{id}` 로 다시 본다.
> Vercel 서버리스는 요청마다 다른 인스턴스일 수 있어 **인메모리 저장은 요청 간 사라진다**(→ 결과 404).
> 그래서 배포에는 Supabase(외부 Postgres) 어댑터가 필수다. 로컬 개발은 키가 없으면 자동으로 memory로 돈다.

---

## ① GitHub 저장소 생성 — 왜: Vercel이 코드를 가져올 원본

프로젝트 루트(`D:\프로젝트\claude-checkup`)에서:

```bash
gh repo create x77xdavid-prog/claude-checkup --<public 또는 private> --source . --push
```

- `<public 또는 private>` 자리에 `--public` 또는 `--private` 중 하나를 실제로 적는다.
- `--source .` = 현재 폴더를 그대로, `--push` = 첫 커밋까지 업로드.
- 이미 커밋이 없다면 먼저 `git add -A && git commit -m "chore: 배포 준비"`.

> `.env` 는 `.gitignore` 에 있어 올라가지 않는다(비밀키 유출 방지). `.env.example` 만 올라간다.

---

## ② Supabase 프로젝트 생성 + 스키마 적용 — 왜: 결과·구독·검색로그의 영속 저장소

1. https://supabase.com → **New project** (리전은 사용자와 가까운 곳, 예: Seoul/Tokyo).
2. 프로젝트가 뜨면 좌측 **SQL Editor** → **New query** → 아래 파일 **전체 내용**을 붙여넣고 **Run**:
   ```
   supabase/migrations/0001_init.sql
   ```
   → `scans` · `subscribers` · `search_logs` 3개 테이블 + RLS(전부 차단, 서버 service_role만 통과)가 생성된다.
   왜 RLS: anon 키가 노출돼도 DB를 직접 못 건드리게. 서버만 service_role로 접근.
3. 좌측 **Project Settings → API** 에서 3개 값 복사(다음 단계에서 씀):
   - **Project URL** (예: `https://abcd.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 서버 전용 비밀. 절대 공개 금지)

---

## ③ Vercel 임포트 + 환경변수 — 왜: 빌드·호스팅 + DB 연결

1. https://vercel.com → **Add New → Project** → ①에서 만든 GitHub repo 선택 → **Import**.
   - Framework은 **Next.js** 자동 감지(별도 설정 불필요). Build/Output 기본값 그대로 둔다.
2. **Environment Variables** 에 아래를 넣는다(`.env.example` 의 7개 키 그대로).
   Production/Preview 모두 체크.

   | 키 | 값 채우는 법 | 지금 필수? |
   |----|------------|:---------:|
   | `NEXT_PUBLIC_SITE_URL` | 배포 후 확정되는 도메인(예: `https://claude-checkup.vercel.app`). **일단 임시로 넣고 배포 후 실제 도메인으로 수정 → 재배포.** SEO canonical·OG·sitemap 기준값. | ✅ |
   | `NEXT_PUBLIC_SUPABASE_URL` | ②의 Project URL | ✅ (배포 핵심) |
   | `SUPABASE_SERVICE_ROLE_KEY` | ②의 service_role 키 | ✅ (배포 핵심) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ②의 anon 키 | ⬜ 예약(현재 코드 미사용, 향후 클라이언트 조회용) |
   | `RESEND_API_KEY` | Resend 가입 후 발급(뉴스레터 발송용) | ⬜ 예약(발송 기능은 P3) |
   | `STRIPE_SECRET_KEY` | Stripe 대시보드(결제용) | ⬜ 예약(결제는 stub) |
   | `STRIPE_WEBHOOK_SECRET` | Stripe 웹훅 설정 후 | ⬜ 예약(결제는 stub) |

   > 어댑터 선택 규칙: `NEXT_PUBLIC_SUPABASE_URL`(또는 `SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY`가 **둘 다** 있으면
   > Supabase, 하나라도 없으면 memory. → 배포 핵심 2개(+URL)만 정확하면 영속 저장이 켜진다. 예약 4개는 비워도 빌드·구동 OK.
3. **Deploy** 클릭 → 빌드 완료까지 대기.
4. 배포 URL 확인 후, `NEXT_PUBLIC_SITE_URL` 을 그 실제 도메인으로 수정 → **Redeploy**(SEO 메타 정확화).

---

## ④ 배포 후 스모크 테스트 — 왜: 서버리스에서 저장/조회가 실제로 붙는지 확인

로컬 터미널에서(도메인은 본인 것으로):

```bash
node scanner/checkup.mjs --yes --base https://<your-domain>
```

- 콘솔에 `전송 완료. 결과 페이지: https://<your-domain>/result/<uuid>` 가 나오면 저장 성공.
- 그 URL을 **새 창(또는 몇 초 뒤)** 에 열어 점수·영역 막대가 보이면 = 다른 서버리스 인스턴스에서도 조회됨 = 영속 저장 정상.
  (memory였다면 여기서 "결과를 찾을 수 없음"이 떠야 정상 — 즉 이게 안 뜨면 Supabase가 잘 붙은 것.)
- 사이트에서 **구독 폼**에 이메일을 넣어 제출 → Supabase 대시보드 **Table Editor → subscribers** 에 행이 생기면 OK.

문제 시 확인 순서: Vercel **Deployment → Functions 로그** 에서 `saveScan 실패`/`Supabase 설정 누락` 메시지 → 환경변수 오타 점검.

---

## 참고 — 자동 정리(선택)

`scans` 는 개인 진단이라 장기 보관 불필요. `supabase/migrations/0001_init.sql` 하단 주석에
`pg_cron` 으로 30일 후 자동 삭제하는 예시가 있다(필수 아님).
