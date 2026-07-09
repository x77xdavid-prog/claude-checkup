// 순수 렌더 함수(I/O 없음) — 이메일 제목·HTML·텍스트 생성만 한다.
// 모든 메일에 발신자 신원 + 수신거부 링크 필수(정보통신망법·CAN-SPAM). HTML은 인라인 스타일(메일 호환).

import { fileURLToPath } from "node:url";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// 다이제스트 항목 — 카탈로그 데이터 구조에 의존하지 않도록 필요한 필드만 받는다(순수성 유지).
export interface DigestSkill {
  name: string;
  category: string;
  source: string;
  addedAt?: string;
}

const SENDER = "claude-checkup"; // 발신자 신원
const CATALOG_URL = "https://claudecowork.co.kr/ko/catalog";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

// HTML 이스케이프 — 카탈로그/URL 값이 속성·본문을 깨거나 주입에 쓰이지 않게(메일 안전).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 모든 메일 공통 푸터 — 발신자 신원 + 수신거부(법적 필수).
function footerHtml(unsubUrl: string): string {
  return (
    `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>` +
    `<p style="font-size:12px;color:#888;line-height:1.6">` +
    `${SENDER} 뉴스레터 구독자에게 발송된 메일입니다.<br/>` +
    `수신을 원치 않으시면 <a href="${esc(unsubUrl)}" style="color:#888">수신거부</a>하세요.` +
    `</p>`
  );
}

function footerText(unsubUrl: string): string {
  return `\n\n----\n${SENDER} 뉴스레터 구독자에게 발송된 메일입니다.\n수신거부: ${unsubUrl}`;
}

// 이중 옵트인 확인 메일 — 확인 링크 + 발신자 신원 + 수신거부.
export function renderConfirmEmail(confirmUrl: string, unsubUrl: string): RenderedEmail {
  const subject = `[${SENDER}] 뉴스레터 구독을 확인해 주세요`;
  const html =
    `<div style="font-family:${FONT};max-width:560px;margin:0 auto;color:#222">` +
    `<h1 style="font-size:20px">뉴스레터 구독 확인</h1>` +
    `<p style="line-height:1.7">${SENDER} 뉴스레터를 신청해 주셔서 감사합니다. 아래 버튼을 눌러 구독을 확인해 주세요.</p>` +
    `<p style="margin:24px 0"><a href="${esc(confirmUrl)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">구독 확인하기</a></p>` +
    `<p style="font-size:13px;color:#666;line-height:1.6">버튼이 동작하지 않으면 이 주소를 브라우저에 붙여넣으세요:<br/>${esc(confirmUrl)}</p>` +
    footerHtml(unsubUrl) +
    `</div>`;
  const text =
    `[${SENDER}] 뉴스레터 구독 확인\n\n` +
    `${SENDER} 뉴스레터를 신청해 주셔서 감사합니다.\n` +
    `아래 링크로 구독을 확인해 주세요:\n${confirmUrl}` +
    footerText(unsubUrl);
  return { subject, html, text };
}

// 다이제스트 메일 — 새로 추가된 검증 스킬 목록 + 카탈로그 링크 + 발신자 신원 + 수신거부.
export function renderDigestEmail(skills: DigestSkill[], unsubUrl: string): RenderedEmail {
  const subject = `[${SENDER}] 새로 추가된 검증 스킬 ${skills.length}개`;
  const items = skills
    .map(
      (s) =>
        `<li style="margin:8px 0;line-height:1.6"><strong>${esc(s.name)}</strong>` +
        ` <span style="color:#666">— ${esc(s.category)} · ${esc(s.source)}</span></li>`,
    )
    .join("");
  const html =
    `<div style="font-family:${FONT};max-width:560px;margin:0 auto;color:#222">` +
    `<h1 style="font-size:20px">새로 추가된 검증 스킬</h1>` +
    `<ul style="padding-left:18px">${items}</ul>` +
    `<p style="margin:24px 0"><a href="${esc(CATALOG_URL)}" style="color:#111">카탈로그에서 전체 보기 →</a></p>` +
    footerHtml(unsubUrl) +
    `</div>`;
  const textItems = skills.map((s) => `- ${s.name} (${s.category} · ${s.source})`).join("\n");
  const text =
    `[${SENDER}] 새로 추가된 검증 스킬\n\n` +
    `${textItems}\n\n` +
    `카탈로그에서 전체 보기: ${CATALOG_URL}` +
    footerText(unsubUrl);
  return { subject, html, text };
}

// ── 최소 자가검증 — 두 렌더러가 수신거부 링크·발신자 신원을 포함하고 비어있지 않은지 확인 ──
export function selfTest(): void {
  const unsub = "https://claudecowork.co.kr/api/unsubscribe?token=test-token";
  const confirm = renderConfirmEmail("https://claudecowork.co.kr/api/confirm?token=test-token", unsub);
  const digest = renderDigestEmail(
    [
      { name: "pg-payments", category: "payments", source: "ecc" },
      { name: "korea-public-data", category: "data", source: "ecc", addedAt: "2026-07-09" },
    ],
    unsub,
  );
  for (const [label, mail] of [
    ["confirm", confirm],
    ["digest", digest],
  ] as const) {
    if (!mail.subject.trim()) throw new Error(`FAIL ${label}: subject 비어있음`);
    if (!mail.html.trim() || !mail.text.trim()) throw new Error(`FAIL ${label}: 본문 비어있음`);
    if (!mail.html.includes(unsub) || !mail.text.includes(unsub)) throw new Error(`FAIL ${label}: 수신거부 링크 누락`);
    if (!mail.html.includes(SENDER) || !mail.text.includes(SENDER)) throw new Error(`FAIL ${label}: 발신자 신원 누락`);
  }
  // 확인 메일은 확인 링크를 반드시 포함(이중 옵트인)
  if (!confirm.html.includes("confirm?token=test-token")) throw new Error("FAIL confirm: 확인 링크 누락");
  console.log("render.ts self-check OK");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  selfTest();
}
