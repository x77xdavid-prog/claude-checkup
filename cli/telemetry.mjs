// cli/telemetry.mjs — checkup-skills CLI 익명 사용 통계 (프라이버시 우선).
//
// 수집 필드는 정확히 5개뿐: { event, value(120자 절단), cliVersion, locale(대략), ts }.
// 그 외 일체 수집 안 함 — IP·머신ID·사용자명·경로 등은 이 페이로드에 없다(서버도 raw IP 미저장).
//
// opt-out: CHECKUP_TELEMETRY=0 | 표준 DO_NOT_TRACK | CI(truthy) → 완전 비활성.
// 전송: fire-and-forget, AbortController 1500ms 타임아웃, 실패는 완전 무음 — CLI를 절대 느리게/깨지게 하지 않는다.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const TELEMETRY_URL_DEFAULT = "https://claudecowork.co.kr/api/cli-event";
const VALUE_MAX = 120;
const TIMEOUT_MS = 1500;
const NOTICE_DIR_NAME = ".checkup-skills";
const NOTICE_FILE_NAME = "telemetry-notice-shown";
const NOTICE_TEXT =
  "checkup-skills는 카탈로그 개선을 위해 익명 사용 통계(검색어)를 수집합니다. 끄기: CHECKUP_TELEMETRY=0";

// "0"/""/"false"(대소문자 무시)는 falsy, 그 외 존재하는 값은 truthy — DO_NOT_TRACK/CI 표준 관례.
function truthyEnvFlag(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "false";
}

// opt-out 3종 검사(순수 함수 — env를 주입받아 테스트 용이).
export function shouldSend(env) {
  const e = env ?? {};
  if (String(e.CHECKUP_TELEMETRY ?? "") === "0") return false;
  if (truthyEnvFlag(e.DO_NOT_TRACK)) return false;
  if (truthyEnvFlag(e.CI)) return false;
  return true;
}

// 대략적 로케일 — LANG 앞 5자(예: "ko_KR.UTF-8" → "ko_KR"), 없으면 null.
function coarseLocale(env) {
  const raw = env?.LANG;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim().slice(0, 5);
}

// 페이로드 구성(순수 함수) — 정확히 5개 필드만.
export function buildPayload(event, value, version, env) {
  return {
    event,
    value: String(value ?? "").slice(0, VALUE_MAX),
    cliVersion: version,
    locale: coarseLocale(env),
    ts: new Date().toISOString(),
  };
}

// ── 최초 1회 고지 ────────────────────────────────────────────────────────────

function noticeMarkerPath() {
  return path.join(os.homedir(), NOTICE_DIR_NAME, NOTICE_FILE_NAME);
}

// 마커 파일이 없을 때만 stderr에 1줄 고지 후 마커를 남긴다. 쓰기 실패해도 무음(크래시 금지) —
// 최악의 경우 다음 실행에서 고지가 반복될 뿐이다.
function noticeOnce() {
  try {
    const marker = noticeMarkerPath();
    if (fs.existsSync(marker)) return;
    console.error(NOTICE_TEXT);
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());
  } catch {
    // 무음 — 마커 디렉터리 접근 불가 등. CLI 동작에 영향 없어야 한다.
  }
}

// ── 전송 (부수 함수) ──────────────────────────────────────────────────────────

// fire-and-forget. shouldSend가 false거나 value가 없으면 네트워크 호출 없이 즉시 반환.
// 호출부는 await 하지 않는다(백그라운드) — 실패는 전부 무음.
export async function sendEvent(event, value, version, env = process.env) {
  if (!value) return;
  if (!shouldSend(env)) return;

  noticeOnce();

  const url = env.CHECKUP_TELEMETRY_URL || TELEMETRY_URL_DEFAULT;
  const payload = buildPayload(event, value, version, env);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // 네트워크 오류·타임아웃·비정상 응답 — 완전 무음. CLI는 이미 결과를 출력했다.
  } finally {
    clearTimeout(timer);
  }
}

// ── 자가검증(assert) — telemetry.mjs 직접 실행과 index.mjs --self-test 양쪽에서 호출 ──
// fs/network 없음(마커 파일에 닿는 경로는 아래에서 거치지 않도록 구성 — value 없음/opt-out 케이스만 실행).

export function selfTestTelemetry() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error("FAIL telemetry self-test: " + msg);
  };

  // shouldSend — opt-out 3종 + 정상 케이스.
  assert(shouldSend({}) === true, "opt-out 없으면 전송 허용");
  assert(shouldSend({ CHECKUP_TELEMETRY: "0" }) === false, "CHECKUP_TELEMETRY=0 → 비활성");
  assert(shouldSend({ CHECKUP_TELEMETRY: "1" }) === true, "CHECKUP_TELEMETRY=1 → 활성");
  assert(shouldSend({ DO_NOT_TRACK: "1" }) === false, "DO_NOT_TRACK=1 → 비활성");
  assert(shouldSend({ CI: "true" }) === false, "CI truthy → 비활성");
  assert(shouldSend({ CI: "" }) === true, "CI 빈 문자열은 falsy → 활성 유지");

  // buildPayload — 필드 구성(정확히 5개) + 120자 절단 + locale 대략화.
  const p = buildPayload("search", "청약", "0.2.0", { LANG: "ko_KR.UTF-8" });
  assert(p.event === "search", "event 보존");
  assert(p.value === "청약", "value 보존");
  assert(p.cliVersion === "0.2.0", "cliVersion 보존");
  assert(p.locale === "ko_KR", "locale은 LANG 앞 5자");
  assert(typeof p.ts === "string" && p.ts.length > 0, "ts는 문자열");
  assert(
    Object.keys(p).sort().join(",") === "cliVersion,event,locale,ts,value",
    "payload 필드는 정확히 5개여야 함(그 외 필드 없음 — 프라이버시 하드 요구사항)",
  );

  const long = buildPayload("info", "x".repeat(200), "0.2.0", {});
  assert(long.value.length === VALUE_MAX, "120자 초과 시 절단");

  const noLang = buildPayload("search", "q", "0.2.0", {});
  assert(noLang.locale === null, "LANG 없으면 locale null");

  // sendEvent — value 없음/opt-out 시 네트워크 호출 없이 즉시 반환해야 함.
  // 가드가 첫 await 이전에 있으므로 호출 즉시(동기적으로) 확인 가능.
  {
    let fetchCalled = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
      fetchCalled = true;
      return realFetch(...args);
    };
    try {
      sendEvent("search", "", "0.2.0", {});
      assert(fetchCalled === false, "value 없으면 전송하지 않아야 함(네트워크 호출 없음)");

      fetchCalled = false;
      sendEvent("search", "정상값", "0.2.0", { CHECKUP_TELEMETRY: "0" });
      assert(fetchCalled === false, "opt-out 상태면 value가 있어도 전송하지 않아야 함");
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  console.log("telemetry.mjs self-test OK");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  selfTestTelemetry();
}
