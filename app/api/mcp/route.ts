// 원격 Streamable HTTP MCP — 스킬 카탈로그를 어떤 MCP 호스트에서도 "한 줄"로 붙여 쓰게 노출.
// 도구(search_skills·skill_info·install_skill·whats_new)는 mcp/lib.mjs의 순수 렌더 로직을 재사용 —
// 로컬 stdio 서버(mcp/index.mjs)와 동일 동작. stateless(disableSse): Redis/외부 상태 없음. 읽기 전용·PII 없음.
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { extractBearer, hashKey, lookupKeyCached, peekKeyCache } from "@/lib/keys";
import {
  fetchCatalog,
  fetchSamplePrompts,
  fetchWhatsNew,
  renderSearch,
  renderSkillInfo,
  renderInstall,
  renderWhatsNew,
  MCP_PROMPTS,
  renderMcpPrompt,
} from "@/mcp/lib.mjs";

const MAX_LIMIT = 50;

function toResult(r: { text: string; isError: boolean }) {
  return r.isError
    ? { content: [{ type: "text" as const, text: r.text }], isError: true }
    : { content: [{ type: "text" as const, text: r.text }] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_skills",
      "claude-checkup 카탈로그 전체에서 이름·설명·카테고리로 스킬을 검색한다(한국어↔영어 교차 검색 지원).",
      {
        query: z.string().describe("검색어(한국어/영어)"),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe("최대 결과 수(기본 10)"),
      },
      async ({ query, limit }) => {
        try {
          const catalog = await fetchCatalog();
          return toResult(renderSearch(catalog, query, limit));
        } catch (err) {
          return toResult({ text: `검색 실패: ${(err as Error).message}`, isError: true });
        }
      },
    );

    server.tool(
      "skill_info",
      "스킬 하나의 상세(설명·출처·라이선스·설치 명령·예시 프롬프트)를 반환한다.",
      { name: z.string().describe("정확한 스킬 이름") },
      async ({ name }) => {
        try {
          const catalog = await fetchCatalog();
          const prompts = await fetchSamplePrompts(name);
          return toResult(renderSkillInfo(catalog, name, prompts));
        } catch (err) {
          return toResult({ text: `조회 실패: ${(err as Error).message}`, isError: true });
        }
      },
    );

    server.tool(
      "install_skill",
      "검증된 출처(marketplace/verified-repo)의 스킬에 한해 정확한 설치 명령을 돌려준다. 미검증 출처는 거부한다. 임의 셸을 실행하지 않는다.",
      { name: z.string().describe("설치할 스킬 이름") },
      async ({ name }) => {
        try {
          const catalog = await fetchCatalog();
          return toResult(renderInstall(catalog, name));
        } catch (err) {
          return toResult({ text: `설치 조회 실패: ${(err as Error).message}`, isError: true });
        }
      },
    );

    server.tool(
      "whats_new",
      "claude-checkup 카탈로그에 최근 추가된 스킬을 최신순으로 반환한다.",
      { limit: z.number().int().min(1).max(50).optional().describe("최대 결과 수(기본 20)") },
      async ({ limit }) => {
        try {
          const data = await fetchWhatsNew();
          return toResult(renderWhatsNew(data, limit));
        } catch (err) {
          return toResult({ text: `조회 실패: ${(err as Error).message}`, isError: true });
        }
      },
    );

    // ── 프롬프트 프리미티브(맛보기 3종) — mcp/lib.mjs 레지스트리 재사용, stdio 서버와 동일 ──
    for (const p of MCP_PROMPTS) {
      const argsSchema: Record<string, z.ZodOptional<z.ZodString>> = {};
      for (const a of p.arguments) {
        argsSchema[a.name] = z.string().optional().describe(a.description);
      }
      server.registerPrompt(
        p.name,
        { title: p.title, description: p.description, argsSchema },
        (args) => ({
          messages: [{ role: "user", content: { type: "text", text: renderMcpPrompt(p.name, args) } }],
        }),
      );
    }
  },
  { serverInfo: { name: "checkup-skills", version: "0.2.0" } },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);

function tooMany(message: string, retryAfterSec: number) {
  return new Response(JSON.stringify({ error: "rate_limited", message }), {
    status: 429,
    headers: { "content-type": "application/json", "Retry-After": String(retryAfterSec) },
  });
}

const ANON_TOO_MANY = "무료 익명 한도(분당 30)를 초과했습니다. 잠시 후 재시도하세요. 상향 한도는 무료 키: POST /api/keys";
const KEY_TOO_MANY = "무료 키 한도(분당 120)를 초과했습니다. 잠시 후 재시도하세요.";

// 익명 티어 게이트(분당 30/IP). 통과 시 handler, 초과 시 429. (무키·비형식 Bearer·무효 키 히트가 공유)
async function anonymousTier(req: Request) {
  const rl = await rateLimit("mcp", clientIp(req.headers));
  if (!rl.allowed) return tooMany(ANON_TOO_MANY, rl.retryAfterSec);
  return handler(req);
}

// 무료 키 티어(분당 120, 키 해시별). 초과 시 429. (유효 키의 캐시 히트 / 미스-첫사용이 공유)
async function keyTier(req: Request, hash: string) {
  const rl = await rateLimit("mcpFree", `key:${hash}`);
  if (!rl.allowed) return tooMany(KEY_TOO_MANY, rl.retryAfterSec);
  return handler(req);
}

// C1c — 위조/미등록 Bearer 난사가 DB를 때리지 못하게: DB 조회는 "캐시 미스일 때만", 그것도 IP 게이트 뒤에서 한다.
//   정상 키 사용자는 첫 1회(미스)에만 게이트 1소모 → 이후 캐시 히트로 무료 티어(120/min)를 온전히 누린다.
async function limited(req: Request) {
  const raw = extractBearer(req.headers); // ck_live_+32 형식 통과분만 non-null (무작위 문자열은 여기서 즉시 익명행 = C1a)
  if (raw) {
    const hash = hashKey(raw);
    const cached = peekKeyCache(hash); // DB 안 타는 순수 캐시 조회. undefined=미스, null=미등록확인(히트), rec=유효(히트)
    if (cached !== undefined) {
      // 캐시 히트 — DB·IP게이트 없이. 유효 키는 무료 티어, 무효 키는 익명 폴백.
      return cached && !cached.revoked ? keyTier(req, hash) : anonymousTier(req);
    }
    // 캐시 미스 = DB 왕복 필요 → 익명 한도(30/IP)로 먼저 게이트해 미스 스팸을 IP당으로 묶는다.
    const gate = await rateLimit("mcp", clientIp(req.headers));
    if (!gate.allowed) return tooMany(ANON_TOO_MANY, gate.retryAfterSec);
    const rec = await lookupKeyCached(hash); // 여기서만 DB왕복 + 캐시 적재
    // 유효 키(첫 사용) → 무료 티어로 승급. 무효 키 → 위 게이트가 익명 한도를 이미 소모했으니 그대로 handler(이중 카운트 금지).
    return rec && !rec.revoked ? keyTier(req, hash) : handler(req);
  }
  // 무키·비형식 Bearer → 익명 티어.
  return anonymousTier(req);
}
export { limited as GET, limited as POST, limited as DELETE };

export const runtime = "nodejs";
export const maxDuration = 60;
