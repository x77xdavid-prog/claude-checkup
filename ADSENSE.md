# AdSense 연결·승인 가이드

claude-checkup에 Google AdSense 광고를 붙이는 절차. **광고 게재 스크립트와 쿠키 동의 메커니즘은 아직 코드에 구현되어 있지 않다** — 앞으로 추가해야 한다. 지금까지 갖춰진 것은 퍼블리셔 선언(`ads.txt` + pub ID)과 정책 페이지들뿐이다.

## 현재 구현 상태 (정직 체크리스트)

- ✅ ads.txt·pub ID
- ✅ /privacy·/terms·/source-policy 페이지
- ✅ sitemap 등록
- ⬜ AdSense 스크립트 head 삽입(미구현)
- ⬜ 쿠키 동의 배너(미구현)

## 전제

- **Publisher ID:** `ca-pub-6683761499521589` (기존 AdSense 계정, 공개값)
- **도메인:** `claudecowork.co.kr` (본인 소유 — AdSense 승인 가능. `*.vercel.app`은 승인 거절되므로 커스텀 도메인 필수)

## 1단계 — 도메인을 Vercel에 연결

1. Vercel → claude-checkup → **Settings → Domains** → `claudecowork.co.kr` 추가 (+ `www`)
2. Vercel이 주는 DNS 레코드를 도메인 등록업체(가비아/후이즈 등) DNS 관리에 입력:
   - 루트 `@` → A 레코드 `76.76.21.21`
   - `www` → CNAME `cname.vercel-dns.com`
3. 전파 대기(10분~24시간), Vercel에서 도메인 상태 **Valid** 확인
4. Vercel 환경변수 `NEXT_PUBLIC_SITE_URL` = `https://claudecowork.co.kr` 로 수정 → **Redeploy**

## 2단계 — AdSense에 광고 코드 활성

1. Vercel 환경변수에 추가: `NEXT_PUBLIC_ADSENSE_ID` = `ca-pub-6683761499521589`
2. `ads.txt`는 이미 `https://claudecowork.co.kr/ads.txt`로 노출된다(승인 심사가 이 파일을 확인). **AdSense 스크립트를 `<head>`에 넣는 코드는 아직 없다 — ⬜ 미구현, 별도로 추가해야 한다.**
3. 광고는 쿠키 동의 후에만 로드되어야 한다(EU/정책 준수). **쿠키 동의 배너도 ⬜ 미구현 — 배너와 동의 연동 게이팅을 구현해야 광고가 실제로 뜬다.**

## 3단계 — AdSense 사이트 추가·심사

1. AdSense → **사이트 메뉴 → 사이트 추가** → `claudecowork.co.kr`
2. AdSense가 주는 심사용 스니펫을 head에 넣는 코드는 아직 없다(⬜ 미구현) — 심사 전에 직접 삽입해야 한다.
3. **심사 대기**(며칠~2주). 승인되면 광고가 실제 게재된다.

### 승인에 유리한 점(이미 충족)
- 실질 콘텐츠 풍부: 스킬 569종·예시 프롬프트 5,690개·16개 언어 → "얇은 콘텐츠" 거절 사유 없음
- 개인정보처리방침 페이지(`/privacy`) 존재 — AdSense 필수
- 이용약관(`/terms`)·출처 정책(`/source-policy`) 페이지도 존재
- 명확한 내비게이션·ads.txt·HTTPS

## 절대 하지 말 것 (계정 정지 사유)

- **자기 광고 클릭 / 클릭 유도 금지** — "여기 눌러주세요" 화살표 등 무효 트래픽 = 즉시 정지
- 광고를 콘텐츠로 오인시키는 배치 금지
- 트래픽 구매로 노출 부풀리기 금지(무효 트래픽 밴)
- 광고 과다 배치 금지 — 현재 2개(카탈로그 in-content 1 + 결과 상단 1)로 뷰어빌리티·CWV 보호. 늘리지 말 것.

## 광고 위치(코드에 이미 반영)

| 위치 | 유형 | 근거 |
|---|---|---|
| 카탈로그 첫 카테고리 뒤 | in-content | 최고 뷰어빌리티, 스크롤 유입 |
| 결과 페이지 점수카드 아래 | in-content | 진단 후 체류 시간 김 |

CLS 방지를 위해 각 슬롯은 `min-height` 예약 — 레이아웃 밀림 0(Core Web Vitals·SEO 보호).

## 수익 현실

`Revenue = 트래픽 × RPM`. 개발자 도구 니치는 RPM이 중간대. 초기 수익은 트래픽에 비례하므로, AdSense는 부수입이고 본 성장 동력은 SEO·구독(P4)이다. 광고가 UX·CWV를 해치지 않는 선(2슬롯)을 유지하는 게 장기적으로 트래픽=수익을 지킨다.
