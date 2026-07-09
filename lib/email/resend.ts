// Resend 어댑터 — `resend` npm 패키지 없이 RAW fetch로 POST /emails. 서버 전용.
// from·apiKey는 selectEmailAdapter가 주입 → 이 모듈은 index를 "타입만" import(런타임 순환 없음).
// 실패(HTTP/네트워크)는 throw하지 않고 EmailResult.error로 담아 반환(호출부가 판단).

import type { EmailAdapter, EmailMessage, EmailResult } from "./index";

const ENDPOINT = "https://api.resend.com/emails";

export function makeResendAdapter(from: string, apiKey: string): EmailAdapter {
  return {
    async send(msg: EmailMessage): Promise<EmailResult> {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: msg.to,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
          }),
        });
        const raw = await res.text();
        if (!res.ok) {
          return { ok: false, dryRun: false, error: parseMessage(raw) ?? `HTTP ${res.status}` };
        }
        const id = parseId(raw);
        return id ? { ok: true, dryRun: false, id } : { ok: true, dryRun: false };
      } catch (e) {
        // 네트워크/DNS/타임아웃 등 — 전송 여부 불확실하므로 실패로 보고.
        return { ok: false, dryRun: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

// 응답 JSON에서 id만 안전 추출(파싱 실패·형 불일치 → undefined).
function parseId(raw: string): string | undefined {
  try {
    const j: unknown = JSON.parse(raw);
    if (j && typeof j === "object" && "id" in j) {
      const id = (j as { id: unknown }).id;
      if (typeof id === "string") return id;
    }
  } catch {
    /* 파싱 불가 → undefined */
  }
  return undefined;
}

// Resend 에러 응답 { name, message } 에서 사람이 읽을 메시지 추출.
function parseMessage(raw: string): string | undefined {
  try {
    const j: unknown = JSON.parse(raw);
    if (j && typeof j === "object") {
      const o = j as { message?: unknown; name?: unknown };
      if (typeof o.message === "string") return o.message;
      if (typeof o.name === "string") return o.name;
    }
  } catch {
    /* 파싱 불가 → undefined */
  }
  return undefined;
}
