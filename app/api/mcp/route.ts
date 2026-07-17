// 원격 Streamable HTTP MCP — 스킬 카탈로그를 어떤 MCP 호스트에서도 "한 줄"로 붙여 쓰게 노출.
// 도구(search_skills·skill_info·install_skill·whats_new)는 mcp/lib.mjs의 순수 렌더 로직을 재사용 —
// 로컬 stdio 서버(mcp/index.mjs)와 동일 동작. stateless(disableSse): Redis/외부 상태 없음. 읽기 전용·PII 없음.
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { rateLimit, clientIp } from "@/lib/ratelimit";
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

async function limited(req: Request) {
  const rl = await rateLimit("mcp", clientIp(req.headers));
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited", message: "무료 익명 한도(분당 30)를 초과했습니다. 잠시 후 재시도하세요." }), { status: 429, headers: { "content-type": "application/json", "Retry-After": String(rl.retryAfterSec) } });
  }
  return handler(req);
}
export { limited as GET, limited as POST, limited as DELETE };

export const runtime = "nodejs";
export const maxDuration = 60;
