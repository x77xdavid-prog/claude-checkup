// IP 기준 메모리 레이트리밋 (스펙 §6). 슬라이딩 윈도우.
// scan 5/min, subscribe 3/min. P2에서 KV로 승급.
//
// ponytail: 인메모리 = 프로세스별·리셋 시 소멸. 서버리스 다중 인스턴스에선 인스턴스별 카운트.
//           P1(단일 dev 인스턴스)엔 충분. 승급 경로 = Upstash/Vercel KV 백엔드로 교체.

type Bucket = number[]; // 요청 타임스탬프(ms) 배열

const g = globalThis as unknown as { __rlStore?: Map<string, Bucket> };
const store: Map<string, Bucket> = g.__rlStore ?? (g.__rlStore = new Map());

const WINDOW_MS = 60_000;

// 프리셋: 이름 → 윈도우당 허용 횟수.
export const LIMITS = {
  scan: 5,
  subscribe: 3,
  searchLog: 20, // 검색 로그 — 분당 20(디바운스 전송 대비 여유)
  cliEvent: 30, // CLI 텔레메트리 — 분당 30(searchLog와 유사한 fire-and-forget 트래픽)
} as const;

export type LimitName = keyof typeof LIMITS;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number; // 차단 시 재시도까지 남은 초(대략)
}

// key는 name+ip 조합으로 만들어 엔드포인트별 독립 카운트.
export function rateLimit(name: LimitName, ip: string): RateResult {
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

// 프록시 헤더에서 클라이언트 IP 추출. Vercel/일반 프록시 대응. 없으면 "unknown".
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// ── 최소 자가검증 ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const ip = "test-" + Math.random();
  let last: RateResult = { allowed: false, remaining: 0, retryAfterSec: 0 };
  for (let i = 0; i < LIMITS.scan; i++) {
    last = rateLimit("scan", ip);
    if (!last.allowed) throw new Error(`FAIL: ${i + 1}번째가 차단됨(허용돼야 함)`);
  }
  const sixth = rateLimit("scan", ip);
  if (sixth.allowed) throw new Error("FAIL: 6번째가 허용됨(차단돼야 함)");
  if (sixth.retryAfterSec < 1) throw new Error("FAIL: retryAfterSec < 1");
  // 다른 이름은 독립
  if (!rateLimit("subscribe", ip).allowed) throw new Error("FAIL: subscribe가 scan 카운트에 오염됨");
  console.log("ratelimit.ts self-check OK");
}
