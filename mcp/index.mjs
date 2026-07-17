#!/usr/bin/env node
// checkup-skills-mcp — 로컬 stdio MCP 서버.
// claude-checkup 카탈로그를 어떤 MCP 호스트(Claude Code/Cursor/Claude Desktop)에서도
// 에이전트 네이티브 도구로 노출한다. 도구: search_skills, skill_info, install_skill, whats_new.
// (스킬 수는 하드코딩 금지 — 카탈로그가 단일 진실. CLAUDE.md 카운트 규칙)
// install_skill은 검증 게이트만 수행하며 임의 셸을 실행하지 않는다.
// 주의: stdio 전송에서 stdout은 JSON-RPC 채널이다 — 서버는 stdout에 로그를 쓰지 않는다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
  MAX_LIMIT,
} from "./lib.mjs";

// 모든 핸들러는 이 형태로 반환. 오류는 isError:true 텍스트로 — 서버는 절대 죽지 않는다.
function textResult(text, isError = false) {
  const result = { content: [{ type: "text", text }] };
  if (isError) result.isError = true;
  return result;
}

const server = new McpServer({ name: "checkup-skills", version: "0.1.0" });

// ── search_skills ─────────────────────────────────────────────────────────────
server.registerTool(
  "search_skills",
  {
    title: "스킬 검색",
    description: "claude-checkup 카탈로그 전체에서 이름·설명·카테고리로 스킬을 검색한다(한국어↔영어 교차 검색 지원).",
    inputSchema: {
      query: z.string().describe("검색어(한국어/영어)"),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe("최대 결과 수(기본 10)"),
    },
  },
  async ({ query, limit }) => {
    let catalog;
    try {
      catalog = await fetchCatalog();
    } catch (err) {
      return textResult(`검색 실패: ${err.message}`, true);
    }
    const r = renderSearch(catalog, query, limit);
    return textResult(r.text, r.isError);
  },
);

// ── skill_info ────────────────────────────────────────────────────────────────
server.registerTool(
  "skill_info",
  {
    title: "스킬 상세",
    description: "스킬 하나의 상세(설명·출처·라이선스·설치 명령·예시 프롬프트)를 반환한다.",
    inputSchema: { name: z.string().describe("정확한 스킬 이름") },
  },
  async ({ name }) => {
    let catalog;
    try {
      catalog = await fetchCatalog();
    } catch (err) {
      return textResult(`조회 실패: ${err.message}`, true);
    }
    const prompts = await fetchSamplePrompts(name);
    const r = renderSkillInfo(catalog, name, prompts);
    return textResult(r.text, r.isError);
  },
);

// ── install_skill (검증 게이트 — 보안 핵심) ───────────────────────────────────
server.registerTool(
  "install_skill",
  {
    title: "스킬 설치(검증 게이트)",
    description:
      "검증된 출처(marketplace/verified-repo)의 스킬에 한해 정확한 설치 명령을 돌려준다. 미검증 출처는 거부한다. 임의 셸을 실행하지 않는다.",
    inputSchema: { name: z.string().describe("설치할 스킬 이름") },
  },
  async ({ name }) => {
    let catalog;
    try {
      catalog = await fetchCatalog();
    } catch (err) {
      return textResult(`설치 조회 실패: ${err.message}`, true);
    }
    const r = renderInstall(catalog, name);
    return textResult(r.text, r.isError);
  },
);

// ── whats_new ──────────────────────────────────────────────────────────────────
server.registerTool(
  "whats_new",
  {
    title: "최근 추가 스킬",
    description: "claude-checkup 카탈로그에 최근 추가된 스킬을 최신순으로 반환한다.",
    inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("최대 결과 수(기본 20)") },
  },
  async ({ limit }) => {
    const data = await fetchWhatsNew();
    const r = renderWhatsNew(data, limit);
    return textResult(r.text, r.isError);
  },
);

// ── 프롬프트 프리미티브(맛보기 3종) — HTTP 라우트와 동일. lib.mjs renderMcpPrompt 재사용. ──
for (const p of MCP_PROMPTS) {
  const argsSchema = {};
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

// ── 시작 ──────────────────────────────────────────────────────────────────────
try {
  await server.connect(new StdioServerTransport());
} catch (err) {
  // stderr로만(스타트업 실패). stdout은 JSON-RPC 채널이라 오염 금지.
  console.error("MCP 서버 시작 실패:", err?.message ?? String(err));
  process.exitCode = 1;
}
