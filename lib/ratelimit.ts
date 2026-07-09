// IP 기준 레이트리밋 (스펙 §6). 슬라이딩 윈도우.
// scan 5/min, subscribe 3/min, searchLog 20/min, cliEvent 30/min.
//
// 백엔드 2종 (lib/db의 selectAdapter와 동일한 "키 있으면 승급, 없으면 폴백" 규약):
//   Upstash   = UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 둘 다 있을 때.
//               서버리스 다중 인스턴스·프로세스 재시작에도 카운트가 살아남는다(영속).
//   in-memory = 그 외(로컬 개발·키 없는 빌드). 프로세스별·리셋 시 소멸 — 단일 인스턴스엔 충분.
//
// rateLimit()은 async: Upstash 왕복이 네트워크 I/O라서. 폴백(인메모리)은 동기 로직을 그대로 감쌌다.

import { fileURLToPath } from "node:url";
import type { Ratelimit as RatelimitInstance } from "@upstash/ratelimit";
import type { Redis as RedisClient } from "@upstash/redis";

const WINDOW_MS = 60_000;

// 프리셋: 이름 → 윈도우당 허용 횟수.
export const LIMITS = {
  scan: 5,
  subscribe: 3,
  searchLog: 20, // 검색 로그 — 분당 20(디바운스 전송 대비 여유)
  cliEvent: 30, // CLI 텔레메트리 — 분당 30(searchLog와 유사한 fire-and-forget 트래픽)
  confirm: 15, // 확인·수신거부 링크 클릭 — 분당 15(저빈도 GET, 리다이렉트/프리페치 여유)
} as const;

export type LimitName = keyof typeof LIMITS;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number; // 차단 시 재시도까지 남은 초(대략)
}

// ── 인메모리 슬라이딩 윈도우 (Upstash 미설정 시 폴백) ─────────────────────────────
// dev의 HMR/모듈 재평가로 저장소가 초기화되는 걸 막기 위해 globalThis에 고정.
type Bucket = number[]; // 요청 타임스탬프(ms) 배열
const g = globalThis as unknown as { __rlStore?: Map<string, Bucket> };
const store: Map<string, Bucket> = g.__rlStore ?? (g.__rlStore = new Map());

// key는 name+ip 조합으로 만들어 엔드포인트별 독립 카운트.
function inMemoryRateLimit(name: LimitName, ip: string): RateResult {
  const limit = LIMITS[name];
  const now = Date.now();
  const key = `${name}:${ip}`;
  const cutoff = now - WINDOW_MS;

  const bucket = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (bucket.length >= limit) {
    store.set(key, bucket); // 만료분 정리해서 다시 저장
    const oldest = bucket[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.push(now);
  store.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.length, retryAfterSec: 0 };
}

// ── Upstash 백엔드 (설정 시) ─────────────────────────────────────────────────────
// 클라이언트·리미터 인스턴스를 지연 생성하고 globalThis에 재사용(supabase.ts client()와 동일 패턴).
// @upstash/* 는 동적 import — 폴백 경로(및 인메모리 자가검증)에선 절대 로드되지 않는다.
type UpstashG = {
  __rlRedis?: RedisClient;
  __rlLimiters?: Map<LimitName, RatelimitInstance>;
};

function upstashConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || "").trim() && (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
  );
}

async function upstashLimiter(name: LimitName): Promise<RatelimitInstance> {
  const ug = globalThis as unknown as UpstashG;
  const redis = ug.__rlRedis ?? (ug.__rlRedis = (await import("@upstash/redis")).Redis.fromEnv());
  const limiters = ug.__rlLimiters ?? (ug.__rlLimiters = new Map<LimitName, RatelimitInstance>());
  const cached = limiters.get(name);
  if (cached) return cached;
  const { Ratelimit } = await import("@upstash/ratelimit");
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(LIMITS[name], "60 s"),
    prefix: `rl:${name}`,
    analytics: false,
  });
  limiters.set(name, limiter);
  return limiter;
}

async function upstashRateLimit(name: LimitName, ip: string): Promise<RateResult> {
  const { success, remaining, reset } = await (await upstashLimiter(name)).limit(ip);
  // retryAfterSec = ceil((reset - now)/1000). 허용 시엔 0(RateResult 계약: "차단 시" 값 — 인메모리와 동일).
  const retryAfterSec = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { allowed: success, remaining, retryAfterSec };
}

// ── 공개 API ─────────────────────────────────────────────────────────────────────
// Upstash 키가 있으면 영속 백엔드, 없으면 인메모리 폴백. 반환 형태(RateResult)는 두 경로 동일.
export async function rateLimit(name: LimitName, ip: string): Promise<RateResult> {
  if (upstashConfigured()) return upstashRateLimit(name, ip);
  return inMemoryRateLimit(name, ip);
}

// 프록시 헤더에서 클라이언트 IP 추출. Vercel/일반 프록시 대응. 없으면 "unknown".
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// ── 최소 자가검증 (async) ──────────────────────────────
// `node lib/ratelimit.ts` 로 직접 실행할 때만 돈다(import될 땐 skip). Node 22.6+/24 타입스트리핑.
// Upstash env를 지워 인메모리 경로를 강제한다.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const run = async () => {
    const ip = "test-" + Math.random();
    for (let i = 0; i < LIMITS.scan; i++) {
      const r = await rateLimit("scan", ip);
      if (!r.allowed) throw new Error(`FAIL: ${i + 1}번째가 차단됨(허용돼야 함)`);
    }
    const sixth = await rateLimit("scan", ip);
    if (sixth.allowed) throw new Error("FAIL: 6번째가 허용됨(차단돼야 함)");
    if (sixth.retryAfterSec < 1) throw new Error("FAIL: retryAfterSec < 1");
    // 다른 이름은 독립 카운트
    if (!(await rateLimit("subscribe", ip)).allowed) throw new Error("FAIL: subscribe가 scan 카운트에 오염됨");
    console.log("ratelimit.ts self-check OK");
  };
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
