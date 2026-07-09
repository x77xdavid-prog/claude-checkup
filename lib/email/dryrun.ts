// dry-run 어댑터 — 아무것도 전송하지 않는다. 콘솔에만 기록.
// RESEND_API_KEY가 없을 때 selectEmailAdapter가 반환하는 안전 기본값(로컬 개발·키 없는 빌드).

import type { EmailAdapter, EmailMessage, EmailResult } from "./index";

const PREVIEW_CHARS = 200; // 본문 미리보기 길이(로그 폭주 방지)

export const dryRunAdapter: EmailAdapter = {
  async send(msg: EmailMessage): Promise<EmailResult> {
    const preview = msg.text.slice(0, PREVIEW_CHARS);
    console.log(`[email dry-run] to=${msg.to} subject=${msg.subject}\n${preview}`);
    return { ok: true, dryRun: true };
  },
};
