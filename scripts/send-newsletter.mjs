#!/usr/bin/env node
// 뉴스레터 발송 — 확인된(confirmed) 구독자에게 "새로 추가된 검증 스킬" 다이제스트 발송.
//
// 안전 기본값: DRY-RUN(아무것도 보내지 않음). 실발송은 `--send` 플래그 AND RESEND_API_KEY 둘 다 있을 때만.
// 구독자: Supabase REST(confirmed=eq.true)로 로드 — TS db 어댑터는 @/ 별칭 때문에 .mjs에서 import 불가라 REST로 미러링.
// 렌더: lib/email/render.ts의 renderDigestEmail 직접 import(순수 모듈 — Node 타입스트리핑으로 실행 가능, build-catalog.mjs와 동일 방식).
// 다이제스트: public/whats-new.json 있으면 그 skills(최신 N), 없으면 public/catalog.json 폴백 샘플 + 안내 문구.
//
// 실행: node scripts/send-newsletter.mjs           # dry-run(기본)
//       node scripts/send-newsletter.mjs --send    # RESEND_API_KEY 있을 때만 실발송

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDigestEmail } from "../lib/email/render.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://claudecowork.co.kr";
const FROM = process.env.NEWSLETTER_FROM || "claude-checkup <onboarding@resend.dev>";
const DIGEST_COUNT = 10;

const args = new Set(process.argv.slice(2));
const wantSend = args.has("--send");
const hasKey = Boolean((process.env.RESEND_API_KEY || "").trim());
const live = wantSend && hasKey; // 실발송은 둘 다 참일 때만

// ── 구독자 로드 (Supabase REST, confirmed=true) — supabase.ts 접근모델 미러링 ──────
async function loadConfirmedSubscribers() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return { subs: [], note: "Supabase 키 없음 — 구독자 0명(로컬/키 없는 실행)" };
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/subscribers?confirmed=eq.true&select=email,unsub_token`;
  try {
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return { subs: [], note: `Supabase 응답 ${res.status} — 구독자 0명 처리(발송 안 함)` };
    const rows = await res.json();
    const subs = (Array.isArray(rows) ? rows : [])
      .filter((r) => r && typeof r.email === "string" && typeof r.unsub_token === "string")
      .map((r) => ({ email: r.email, unsubToken: r.unsub_token }));
    return { subs, note: null };
  } catch (e) {
    return { subs: [], note: `Supabase 조회 실패(${e.message}) — 구독자 0명 처리(발송 안 함)` };
  }
}

// 카탈로그/whats-new 항목 → DigestSkill({name,category,source,addedAt?}).
function normalizeSkill(e) {
  if (!e || typeof e.name !== "string" || !e.name) return null;
  return {
    name: e.name,
    category: typeof e.category === "string" && e.category ? e.category : "기타",
    source: typeof e.source === "string" && e.source ? e.source : "local",
    addedAt: typeof e.addedAt === "string" ? e.addedAt : undefined,
  };
}

// ── 다이제스트 소스 ─────────────────────────────────────────────────────────────
function loadDigestSkills() {
  const whatsNew = path.join(ROOT, "public", "whats-new.json");
  if (fs.existsSync(whatsNew)) {
    try {
      const data = JSON.parse(fs.readFileSync(whatsNew, "utf8"));
      const raw = Array.isArray(data?.skills) ? data.skills : [];
      const mapped = raw.map(normalizeSkill).filter(Boolean);
      // 최신 N — addedAt 내림차순(있으면), 없으면 파일 순서 유지.
      mapped.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
      return { skills: mapped.slice(0, DIGEST_COUNT), note: null };
    } catch {
      /* 손상 → 폴백으로 진행 */
    }
  }
  // 폴백: catalog.json에서 검증된 스킬 소량 샘플(+ whats_new 미완성 안내).
  const note = "whats-new.json 없음 — 목표2(whats_new) 완료 후 실제 신규 다이제스트로 대체됨";
  let catalog = [];
  try {
    catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "catalog.json"), "utf8"));
  } catch {
    return { skills: [], note: `${note} · catalog.json도 없음 — 다이제스트 비어있음` };
  }
  const list = Array.isArray(catalog) ? catalog : [];
  const verified = list.filter((e) => e && e.install2 && (e.install2.kind === "marketplace" || e.install2.kind === "verified-repo"));
  const sample = (verified.length ? verified : list).slice(0, DIGEST_COUNT);
  return { skills: sample.map(normalizeSkill).filter(Boolean), note };
}

// ── 실발송 (Resend REST — lib/email/resend.ts 미러링) ────────────────────────────
async function sendReal(to, mail) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  const { subs, note: subNote } = await loadConfirmedSubscribers();
  const { skills, note: digestNote } = loadDigestSkills();

  console.log("── 뉴스레터 발송 ──");
  console.log(`모드: ${live ? "LIVE (실발송)" : "DRY-RUN (발송 안 함)"}${wantSend && !hasKey ? "  [--send 지정됐지만 RESEND_API_KEY 없음 → dry-run 강제]" : ""}`);
  console.log(`발신자(FROM): ${FROM}`);
  console.log(`확인된 구독자: ${subs.length}명`);
  if (subNote) console.log(`  주의: ${subNote}`);
  console.log(`다이제스트 스킬: ${skills.length}개`);
  if (digestNote) console.log(`  주의: ${digestNote}`);

  if (subs.length === 0) {
    console.log("── 요약 ──\n대상 0명 — 아무것도 보내지 않고 종료.");
    return;
  }
  if (skills.length === 0) {
    console.log("── 요약 ──\n다이제스트 내용 없음 — 아무것도 보내지 않고 종료.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(sub.unsubToken)}`;
    const mail = renderDigestEmail(skills, unsubUrl);
    if (!live) {
      console.log(`  [dry-run] → ${sub.email}  (제목: ${mail.subject})`);
      continue;
    }
    const r = await sendReal(sub.email, mail);
    if (r.ok) {
      sent++;
      console.log(`  [sent]    → ${sub.email}`);
    } else {
      failed++;
      console.log(`  [FAIL]    → ${sub.email}  (${r.error})`);
    }
  }

  console.log("── 요약 ──");
  if (live) console.log(`실발송: 성공 ${sent} · 실패 ${failed} · 대상 ${subs.length}명`);
  else console.log(`dry-run: 대상 ${subs.length}명 (실제 발송 없음). 실발송하려면 --send 와 RESEND_API_KEY 둘 다 필요.`);
}

main().catch((e) => {
  console.error("스크립트 오류:", e);
  process.exit(1);
});
