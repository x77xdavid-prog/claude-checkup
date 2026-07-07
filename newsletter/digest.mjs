// digest.mjs — data JSON → 자체완결 HTML (외부 CSS/JS 없음, 이메일 호환 테이블 640px).
// 본문 요약 창작 금지: 제목·출처·점수만 표시 (LLM 요약은 P3).
// 실행: node newsletter/digest.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DIGEST_DIR, dataPath, digestPath, todayStr } from "./lib.mjs";

// 신뢰 경계: 외부 API 제목/URL이 그대로 HTML에 들어간다 → 반드시 이스케이프.
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// href는 http/https 절대 URL만 허용 (javascript: 등 스킴 차단).
function safeHref(url = "") {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* 무효 URL → # */
  }
  return "#";
}

const SOURCE_LABEL = { HN: "Hacker News", Reddit: "r/ClaudeAI", "릴리스": "새 릴리스" };
const SOURCE_ORDER = ["HN", "Reddit", "릴리스"];

function fmtKoreanDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function itemRow(it) {
  const href = safeHref(it.url);
  const scoreBadge =
    it.source === "릴리스"
      ? ""
      : `<span style="display:inline-block;font-size:12px;color:#6b7280;margin-left:6px;">▲ ${esc(String(it.score))}</span>`;
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f3;">
        <a href="${href}" style="color:#1f2937;text-decoration:none;font-size:15px;line-height:1.5;font-weight:600;">${esc(it.title)}</a>
        ${scoreBadge}
      </td>
    </tr>`;
}

function sourceSection(source, items) {
  if (!items.length) return "";
  const label = SOURCE_LABEL[source] || source;
  const rows = items.map(itemRow).join("");
  return `
    <tr>
      <td style="padding:22px 0 6px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7c3aed;">${esc(label)}</div>
      </td>
    </tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
    </td></tr>`;
}

function emptyCard() {
  return `
    <tr>
      <td style="padding:40px 24px;text-align:center;background:#f9fafb;border-radius:12px;">
        <div style="font-size:34px;line-height:1;">🌙</div>
        <div style="margin-top:12px;font-size:16px;font-weight:600;color:#374151;">오늘은 소식이 조용합니다</div>
        <div style="margin-top:6px;font-size:13px;color:#9ca3af;">새 클로드 소식이 모이면 내일 다시 전해드릴게요.</div>
      </td>
    </tr>`;
}

export function renderDigest(payload) {
  const day = payload.day || todayStr();
  const title = `클로드 데일리 — ${fmtKoreanDate(day)}`;
  const items = Array.isArray(payload.items) ? payload.items : [];

  let body;
  if (items.length === 0) {
    body = emptyCard();
  } else {
    body = SOURCE_ORDER.map((src) =>
      sourceSection(
        src,
        items.filter((it) => it.source === src)
      )
    ).join("");
  }

  // 이메일 호환: <!doctype html>, 테이블 레이아웃, 인라인 스타일, 640px 컨테이너.
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Malgun Gothic',sans-serif;">
    <tr>
      <td style="padding:28px 32px;background:#111827;">
        <div style="font-size:13px;color:#a78bfa;font-weight:700;letter-spacing:0.1em;">CLAUDE CHECKUP</div>
        <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">${esc(title)}</div>
      </td>
    </tr>
    <tr><td style="padding:8px 32px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${body}
      </table>
    </td></tr>
    <tr>
      <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eef0f3;">
        <div style="font-size:12px;color:#9ca3af;line-height:1.6;">
          이 메일은 <strong style="color:#6b7280;">claude-checkup</strong>이 보냈습니다.<br>
          더 받지 않으려면 <a href="{{UNSUB_URL}}" style="color:#7c3aed;">여기서 해지</a>하세요.
        </div>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

export async function digest({ day = todayStr() } = {}) {
  const inPath = dataPath(day);
  let payload;
  try {
    payload = JSON.parse(await readFile(inPath, "utf8"));
  } catch (e) {
    throw new Error(`data JSON 없음/파싱실패: ${inPath} (${e.message}) — 먼저 crawl.mjs 실행 필요`);
  }
  const html = renderDigest(payload);
  await mkdir(DIGEST_DIR, { recursive: true });
  const out = digestPath(day);
  await writeFile(out, html, "utf8");
  return { out, count: (payload.items || []).length };
}

// 최소 자가검증: 이스케이프/스킴차단/빈카드 분기 — 파일·네트워크 없이.
async function selfCheck() {
  const { strict: assert } = await import("node:assert");
  const evil = renderDigest({
    day: "2026-07-07",
    items: [
      {
        source: "HN",
        title: "<script>alert(1)</script>",
        url: "javascript:alert(1)",
        score: 42,
        created_at: "",
      },
    ],
  });
  assert.ok(!evil.includes("<script>alert(1)</script>"), "제목 XSS 이스케이프 실패");
  assert.ok(evil.includes("&lt;script&gt;"), "이스케이프 산출물 누락");
  assert.ok(!evil.includes('href="javascript:'), "위험 스킴 차단 실패");
  assert.ok(evil.includes("{{UNSUB_URL}}"), "해지 플레이스홀더 누락");

  const empty = renderDigest({ day: "2026-07-07", items: [] });
  assert.ok(empty.includes("조용합니다"), "빈 카드 분기 실패");
  console.log("digest.mjs self-check OK");
}

if (process.argv[1]?.endsWith("digest.mjs")) {
  if (process.argv.includes("--self-check")) {
    await selfCheck();
  } else {
    const { out, count } = await digest();
    console.log(`[digest] 저장: ${out} (${count}개 항목)`);
  }
}
