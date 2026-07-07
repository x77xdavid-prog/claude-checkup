// run.mjs — 매일 진입점. crawl → digest → send 순차 실행.
// 각 단계 소요시간 로그, 실패 시 exit 1 (cron 이 실패를 감지하도록).
//
// ── 스케줄 등록법 (택 1) ─────────────────────────────────────────────
// (A) GitHub Actions cron — .github/workflows/newsletter.yml 로 저장:
//
//     name: daily-newsletter
//     on:
//       schedule:
//         - cron: "0 22 * * *"   # UTC 22:00 = KST 07:00
//       workflow_dispatch:
//     jobs:
//       run:
//         runs-on: ubuntu-latest
//         steps:
//           - uses: actions/checkout@v4
//           - uses: actions/setup-node@v4
//             with: { node-version: 20 }
//           - run: node newsletter/run.mjs
//             env:
//               MAIL_ADAPTER: file        # resend 로 바꾸고 아래 시크릿 추가 시 실발송
//               # RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
//               # RESEND_FROM: ${{ secrets.RESEND_FROM }}
//           - name: commit digest
//             run: |
//               git config user.name  "github-actions"
//               git config user.email "actions@github.com"
//               git add digests newsletter/data
//               git commit -m "chore: daily digest $(date +%F)" || echo "nothing to commit"
//               git push
//
// (B) Claude Code /schedule 루틴 (로컬 PC 켜져 있을 때):
//     /schedule daily 07:00 "cd D:/프로젝트/claude-checkup && node newsletter/run.mjs"
// ─────────────────────────────────────────────────────────────────────
import { crawl } from "./crawl.mjs";
import { digest } from "./digest.mjs";
import { send } from "./send.mjs";
import { todayStr } from "./lib.mjs";

async function step(name, fn) {
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  console.log(`[run] ${name} 완료 (${ms}ms)`);
  return r;
}

async function main() {
  const day = todayStr();
  console.log(`[run] === ${day} 뉴스레터 파이프라인 시작 ===`);
  const total0 = Date.now();

  const { payload } = await step("crawl", () => crawl({ day }));
  const counts = Object.entries(payload.counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[run]   소스별 ${counts} → 최종 ${payload.items.length}개`);
  if (Object.keys(payload.errors).length) {
    for (const [k, v] of Object.entries(payload.errors)) {
      console.warn(`[run]   (소스 실패는 치명적 아님) ${k}: ${v}`);
    }
  }

  const { out } = await step("digest", () => digest({ day }));
  console.log(`[run]   HTML: ${out}`);

  const res = await step("send", () => send({ day }));
  console.log(`[run]   send 결과: ${JSON.stringify(res)}`);

  console.log(`[run] === 완료 (총 ${Date.now() - total0}ms) ===`);
}

main().catch((e) => {
  console.error(`[run] 실패: ${e.stack || e.message}`);
  process.exit(1);
});
