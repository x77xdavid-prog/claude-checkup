// send.mjs — MAIL_ADAPTER=file(기본)|resend.
//   file   : 발송하지 않고 다이제스트 경로만 안내.
//   resend : RESEND_API_KEY 필수. 수신자는 SUBSCRIBERS_FILE(json 배열)에서 읽는다.
//            (API_BASE에서 GET하는 경로는 아직 미구현 → 명시적 에러)
// 실행: node newsletter/send.mjs
import { readFile } from "node:fs/promises";
import { digestPath, todayStr } from "./lib.mjs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readDigestHTML(day) {
  const p = digestPath(day);
  try {
    const html = await readFile(p, "utf8");
    return { path: p, html };
  } catch {
    throw new Error(`다이제스트 없음: ${p} — 먼저 digest.mjs(또는 run.mjs) 실행 필요`);
  }
}

// file 어댑터: 아무것도 안 보낸다.
async function sendFile(day) {
  const { path } = await readDigestHTML(day);
  console.log(`[send:file] 다이제스트 생성됨: ${path}`);
  console.log(
    "[send:file] 발송하려면 RESEND_API_KEY 설정 후 MAIL_ADAPTER=resend 로 다시 실행하세요."
  );
  return { sent: 0, adapter: "file" };
}

// 구독자 로드: SUBSCRIBERS_FILE(json 배열: ["a@b.com"] 또는 [{email,unsub_token}]) 만 지원.
async function loadSubscribers() {
  const file = process.env.SUBSCRIBERS_FILE;
  if (file) {
    let raw;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      throw new Error(`SUBSCRIBERS_FILE 파싱 실패: ${file} (${e.message})`);
    }
    if (!Array.isArray(raw)) throw new Error("SUBSCRIBERS_FILE 는 JSON 배열이어야 함");
    return raw
      .map((x) => (typeof x === "string" ? { email: x } : x))
      .filter((x) => x && EMAIL_RE.test(x.email || ""));
  }
  if (process.env.API_BASE) {
    // 스펙 지시: API 연동은 TODO 주석이 아니라 명시적 미구현 에러로.
    throw new Error(
      "API_BASE 기반 구독자 조회는 아직 미구현(P3). 지금은 SUBSCRIBERS_FILE 만 지원합니다."
    );
  }
  throw new Error(
    "구독자 소스 없음: SUBSCRIBERS_FILE(json 배열) 환경변수를 설정하세요."
  );
}

// resend 어댑터: 실발송.
async function sendResend(day) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "MAIL_ADAPTER=resend 인데 RESEND_API_KEY 가 없습니다. .env 에 키를 넣으세요."
    );
  }
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error("RESEND_FROM(발신 주소) 환경변수가 필요합니다. 예: 'Claude Checkup <daily@yourdomain>'");
  }

  const { html } = await readDigestHTML(day);
  const subscribers = await loadSubscribers();
  if (subscribers.length === 0) {
    console.warn("[send:resend] 구독자 0명 — 발송 대상 없음.");
    return { sent: 0, failed: 0, adapter: "resend" };
  }

  const subject = `클로드 데일리 — ${day}`;
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    // 해지 링크 개인화: 구독자별 토큰이 있으면 치환 (없으면 자리표시자 유지).
    const personalized = sub.unsub_token
      ? html.replaceAll(
          "{{UNSUB_URL}}",
          `${process.env.API_BASE || ""}/unsubscribe?token=${encodeURIComponent(sub.unsub_token)}`
        )
      : html;
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: sub.email, subject, html: personalized }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
      }
      sent++;
    } catch (e) {
      failed++;
      console.warn(`[send:resend] 실패 ${sub.email}: ${e.message}`);
    }
  }
  console.log(`[send:resend] 발송 완료: 성공 ${sent} / 실패 ${failed} (총 ${subscribers.length})`);
  return { sent, failed, adapter: "resend" };
}

export async function send({ day = todayStr(), adapter = process.env.MAIL_ADAPTER || "file" } = {}) {
  if (adapter === "resend") return sendResend(day);
  if (adapter === "file") return sendFile(day);
  throw new Error(`알 수 없는 MAIL_ADAPTER='${adapter}' (file | resend 중 하나)`);
}

if (process.argv[1]?.endsWith("send.mjs")) {
  try {
    await send();
  } catch (e) {
    console.error(`[send] 오류: ${e.message}`);
    process.exit(1);
  }
}
