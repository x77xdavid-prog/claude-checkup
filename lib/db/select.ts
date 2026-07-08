// 어댑터 선택 로직 — 순수 함수(런타임 import 0). 배포 게이트 #3에서 node로 직접 검증한다.
//   node lib/db/select.ts   ← Node 22.6+/24는 타입 스트리핑으로 바로 실행 가능(import 없음).
//
// 규칙: Supabase URL + service_role 키가 둘 다 있으면 supabase, 아니면 memory(로컬 개발·키 없는 빌드).
//   URL 키 이름은 SUPABASE_URL(서버 전용)을 우선, 없으면 .env.example의 NEXT_PUBLIC_SUPABASE_URL 사용.

import { fileURLToPath } from "node:url"; // 빌트인 — 자가검증 진입점 판별에만 사용(런타임 부담 없음)

export type AdapterName = "supabase" | "memory";

type EnvLike = Record<string, string | undefined>;

export function selectAdapter(env: EnvLike = process.env): AdapterName {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return url.length > 0 && key.length > 0 ? "supabase" : "memory";
}

// ── 최소 자가검증(assert) — 분기가 깨지면 즉시 실패 ─────────────────────────────
// `node lib/db/select.ts` 로 직접 실행할 때만 돈다(import될 땐 skip).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const eq = (a: AdapterName, b: AdapterName, m: string) => {
    if (a !== b) throw new Error(`FAIL ${m}: ${a} !== ${b}`);
  };
  eq(selectAdapter({}), "memory", "빈 env → memory");
  eq(selectAdapter({ SUPABASE_URL: "https://x.supabase.co" }), "memory", "URL만 → memory(키 없음)");
  eq(selectAdapter({ SUPABASE_SERVICE_ROLE_KEY: "sk" }), "memory", "키만 → memory(URL 없음)");
  eq(selectAdapter({ SUPABASE_URL: "  ", SUPABASE_SERVICE_ROLE_KEY: "sk" }), "memory", "공백 URL → memory");
  eq(selectAdapter({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sk" }), "supabase", "URL+키 → supabase");
  eq(selectAdapter({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sk" }), "supabase", "NEXT_PUBLIC URL 폴백 → supabase");
  console.log("select.ts self-check OK");
}
