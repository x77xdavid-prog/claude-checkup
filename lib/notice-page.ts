// 확인·수신거부 링크 클릭에 대한 사용자 대면 HTML 안내 페이지(브라우저 GET 응답).
// 두 라우트(app/api/confirm, app/api/unsubscribe)가 공유 — 동일 셸 중복 방지(DRY).
// 보안: 사용자 입력(토큰 등)을 페이지에 반사하지 않는다. title/message는 라우트가 넘기는 정적 한글 문구만 → XSS 없음.

export interface NoticeOpts {
  title: string; // 페이지 제목 + 본문 헤딩(정적 문구)
  message: string; // 본문 설명(정적 문구)
  status: number; // HTTP 상태
  retryAfterSec?: number; // 429일 때만 Retry-After 헤더로 반영
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif";

// 인라인 CSS·무의존. 라이트/다크 모두 대응(prefers-color-scheme). 사용자 입력 미반사.
function html({ title, message }: NoticeOpts): string {
  return (
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
    `<meta name="robots" content="noindex"/>` +
    `<title>${title} · claude-checkup</title>` +
    `<style>` +
    `:root{color-scheme:light dark}` +
    `*{box-sizing:border-box}` +
    `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `font-family:${FONT};background:#fafafa;color:#1a1a1a;padding:24px;line-height:1.7}` +
    `main{max-width:440px;width:100%;background:#fff;border:1px solid #e5e5e5;border-radius:16px;` +
    `padding:40px 32px;text-align:center}` +
    `h1{font-size:22px;margin:0 0 12px}` +
    `p{font-size:15px;color:#555;margin:0 0 24px}` +
    `a{display:inline-block;background:#111;color:#fff;padding:11px 22px;border-radius:8px;` +
    `text-decoration:none;font-weight:600;font-size:14px}` +
    `@media(prefers-color-scheme:dark){body{background:#0d0d0d;color:#f2f2f2}` +
    `main{background:#171717;border-color:#2a2a2a}p{color:#a3a3a3}a{background:#fafafa;color:#111}}` +
    `</style></head><body><main>` +
    `<h1>${title}</h1>` +
    `<p>${message}</p>` +
    `<a href="https://claudecowork.co.kr">claude-checkup 홈으로</a>` +
    `</main></body></html>`
  );
}

export function noticePage(opts: NoticeOpts): Response {
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (opts.retryAfterSec && opts.retryAfterSec > 0) headers["Retry-After"] = String(opts.retryAfterSec);
  return new Response(html(opts), { status: opts.status, headers });
}
