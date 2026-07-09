// 원격 Streamable HTTP MCP — 스킬 카탈로그를 어떤 MCP 호스트에서도 "한 줄"로 붙여 쓰게 노출.
// 도구 3종(search_skills·skill_info·install_skill)은 mcp/lib.mjs의 순수 렌더 로직을 재사용 —
// 로컬 stdio 서버(mcp/index.mjs)와 동일 동작. stateless(disableSse): Redis/외부 상태 없음. 읽기 전용·PII 없음.
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import {
  fetchCatalog,
  fetchSamplePrompts,
  renderSearch,
  renderSkillInfo,
  renderInstall,
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
      "claude-checkup 카탈로그(979+종)에서 이름·설명·카테고리로 스킬을 검색한다.",
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
  },
  { serverInfo: { name: "checkup-skills", version: "0.1.0" } },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };

export const runtime = "nodejs";
export const maxDuration = 60;
