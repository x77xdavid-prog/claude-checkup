// 이메일 어댑터 (lib/db와 동일한 "키 있으면 승급, 없으면 안전 폴백" 규약).
//   RESEND_API_KEY 있으면 Resend(실발송), 없으면 dry-run(콘솔 기록·발송 없음).
// resend.ts/dryrun.ts는 여기서 "값"을 가져오지만, 그쪽은 index를 "타입만" 되가져온다
// → 런타임 순환 없음(lib/db의 index↔구현 규약과 동일).

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  ok: boolean;
  dryRun: boolean;
  id?: string;
  error?: string;
}

export interface EmailAdapter {
  send(msg: EmailMessage): Promise<EmailResult>;
}

// 발신자 신원(정보통신망법·CAN-SPAM 필수). 배포 시 NEWSLETTER_FROM에 검증된 도메인 주소 지정.
// 미설정 시 Resend 테스트 발신자(onboarding@resend.dev)로 폴백.
export const FROM = process.env.NEWSLETTER_FROM || "claude-checkup <onboarding@resend.dev>";

import { makeResendAdapter } from "./resend";
import { dryRunAdapter } from "./dryrun";

// 키 있으면 Resend, 없으면 dry-run. 키가 없을 때는 절대 외부로 전송하지 않는다(안전 기본값).
export function selectEmailAdapter(): EmailAdapter {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? makeResendAdapter(FROM, apiKey) : dryRunAdapter;
}
