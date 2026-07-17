// 무료 API 키 — 생성·해시·Bearer 추출·조회 캐시 (MCP 수익화 2단계).
// 키 원문은 서버에 저장하지 않는다: 발급 응답에 1회만 노출하고 DB엔 sha256 해시만 둔다.
// node:crypto만 사용(외부 의존성 0). server 전용(getApiKey를 호출하는 db import 포함).

import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ApiKeyRecord } from "@/lib/db"; // 타입 전용(빌드 시 소거) — 순수 헬퍼는 db 그래프를 끌어오지 않는다

// ck_live_ 프리픽스로 사람·로그가 키를 한눈에 식별. 뒤는 24바이트(192비트) base64url = 32자.
const KEY_PREFIX = "ck_live_";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// { key, hash } — key는 발급 응답용(1회 노출), hash는 DB 저장·조회용.
export function generateKey(): { key: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key) };
}

// 우리 키의 정확한 형식: ck_live_ + base64url 32자(generateKey의 randomBytes(24) 인코딩 길이와 일치).
const KEY_RE = /^ck_live_[A-Za-z0-9_-]{32}$/;

// "Authorization: Bearer ck_live_..." → 키 원문. Bearer 아님/형식 불일치/헤더 없음 → null.
// 프리픽스만이 아니라 정확한 형식(길이·문자셋)까지 검증한다 → 우리 키가 아닌/무작위 토큰은 hashKey·DB·캐시를
// 타지 않고 즉시 익명 처리된다(위조 Bearer 난사로 인한 DB 폭주·캐시 증식을 앞단에서 차단, C1a).
export function extractBearer(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(auth.trim());
  if (!m) return null;
  return KEY_RE.test(m[1]) ? m[1] : null;
}

// ── 60초 인메모리 캐시 — MCP 콜마다 DB 왕복 방지 ──────────────────────────────────
// dev의 HMR/모듈 재평가로 캐시가 초기화되는 걸 막기 위해 globalThis에 고정(ratelimit.ts __rlStore 패턴).
// null(미등록/회수)도 캐싱해 존재하지 않는 키의 반복 조회도 막는다. TTL 짧아 회수 반영 지연은 최대 60초.
const CACHE_TTL_MS = 60_000;
// 캐시 엔트리 상한 — 위조/미등록 Bearer가 서로 다른 해시로 캐시를 무한 증식(메모리 OOM)시키는 걸 막는다(C1b).
// 도달 시 삽입순서상 가장 오래된 엔트리 1개를 축출(Map은 삽입순 보존 → FIFO). 정상 키 수는 이보다 훨씬 적다.
const KEY_CACHE_MAX = 5000;
type CacheEntry = { rec: ApiKeyRecord | null; exp: number };
const g = globalThis as unknown as { __keyCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = g.__keyCache ?? (g.__keyCache = new Map());

// 캐시만 조회한다(DB 안 탐). 순수·동기. 반환값의 3-상태를 호출부가 구분한다:
//   ApiKeyRecord = 유효 레코드가 캐시에 있음(히트)
//   null         = "미등록/회수로 확인됨"이 캐시에 있음(히트) — null도 유효한 캐시값이라 DB 재조회 안 함
//   undefined    = 캐시에 없음(미스) — 호출부가 DB 조회(예: IP 게이트 뒤) 여부를 결정
// 만료 엔트리는 여기서 실제 삭제하고 미스(undefined)로 취급 → 상한 관리에도 즉시 반영된다.
export function peekKeyCache(hash: string): ApiKeyRecord | null | undefined {
  const hit = cache.get(hash);
  if (!hit) return undefined;
  if (hit.exp <= Date.now()) {
    cache.delete(hash);
    return undefined;
  }
  return hit.rec;
}

// 캐시 적재 — 신규 해시인데 상한에 도달했으면 가장 오래된 엔트리 1개를 먼저 축출(FIFO). 기존 해시 갱신은 축출 안 함.
function setKeyCache(hash: string, rec: ApiKeyRecord | null): void {
  if (!cache.has(hash) && cache.size >= KEY_CACHE_MAX) {
    const oldest = cache.keys().next().value; // 삽입순 최선두 = 가장 오래된 키
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(hash, { rec, exp: Date.now() + CACHE_TTL_MS });
}

export async function lookupKeyCached(hash: string): Promise<ApiKeyRecord | null> {
  const cached = peekKeyCache(hash);
  if (cached !== undefined) return cached; // 히트(null 포함) → DB 왕복 없음
  // db는 여기서만 지연 로드(동적 import) — extractBearer/hashKey만 쓰는 호출부는 supabase 그래프를 안 끌어온다.
  const { db } = await import("@/lib/db");
  const rec = await db.getApiKey(hash);
  setKeyCache(hash, rec);
  return rec;
}

// ── 최소 자가검증 — `node lib/keys.ts` 로 직접 실행할 때만 돈다(import 시 skip). Node 22.6+/24 타입스트리핑 ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { key, hash } = generateKey();
  if (!key.startsWith(KEY_PREFIX)) throw new Error("FAIL: 프리픽스 없음");
  if (hash !== hashKey(key)) throw new Error("FAIL: generateKey.hash != hashKey(key)");
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("FAIL: sha256 hex 형식 아님");
  if (generateKey().key === generateKey().key) throw new Error("FAIL: 키가 유일하지 않음");
  const h = (auth: string | null) => extractBearer(new Headers(auth ? { authorization: auth } : {}));
  if (h(`Bearer ${key}`) !== key) throw new Error("FAIL: 유효 Bearer 추출 실패");
  if (h(`bearer ${key}`) !== key) throw new Error("FAIL: 대소문자 무시 실패");
  if (h(null) !== null) throw new Error("FAIL: 헤더 없음이 null 아님");
  if (h("Bearer sk_other_token") !== null) throw new Error("FAIL: 다른 프리픽스가 null 아님");
  if (h(key) !== null) throw new Error("FAIL: Bearer 스킴 없는데 통과");
  // C1a 엄격 형식 검증 — ck_live_ + base64url 32자만 통과.
  const okKey = `${KEY_PREFIX}${"A".repeat(32)}`;
  if (h(`Bearer ${okKey}`) !== okKey) throw new Error("FAIL: 정확 32자 형식이 거부됨");
  if (h(`Bearer ${KEY_PREFIX}short`) !== null) throw new Error("FAIL: 32자 미만이 통과됨");
  if (h(`Bearer ${KEY_PREFIX}${"A".repeat(33)}`) !== null) throw new Error("FAIL: 32자 초과가 통과됨");
  if (h(`Bearer ${KEY_PREFIX}${"A".repeat(31)}+`) !== null) throw new Error("FAIL: base64url 외 문자(+)가 통과됨");
  // C1b/C1c peekKeyCache — 미조회 해시는 undefined(미스). null(확인된 미등록)과 구분됨.
  if (peekKeyCache("0".repeat(64)) !== undefined) throw new Error("FAIL: 미캐시 해시가 undefined 아님");
  console.log("keys.ts self-check OK");
}
