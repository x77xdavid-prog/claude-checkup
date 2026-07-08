#!/usr/bin/env node
// checkup-skills-mcp — 로컬 stdio MCP 서버.
// claude-checkup 카탈로그(977+종)를 어떤 MCP 호스트(Claude Code/Cursor/Claude Desktop)에서도
// 에이전트 네이티브 도구로 노출한다. 도구 3개: search_skills, skill_info, install_skill.
// install_skill은 검증 게이트만 수행하며 임의 셸을 실행하지 않는다.
// 주의: stdio 전송에서 stdout은 JSON-RPC 채널이다 — 서버는 stdout에 로그를 쓰지 않는다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  fetchCatalog,
  filterCatalog,
  findExact,
  installLines,
  fetchSamplePrompts,
  classifyInstall,
  truncate,
  SITE_URL,
  SOURCE_POLICY_URL,
} from "./lib.mjs";

const DESC_MAX = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_SAMPLE_PROMPTS = 5;

// 모든 핸들러는 이 형태로 반환. 오류는 isError:true 텍스트로 — 서버는 절대 죽지 않는다.
function textResult(text, isError = false) {
  const result = { content: [{ type: "text", text }] };
  if (isError) result.isError = true;
  return result;
}

function badge(cls) {
  return cls.verified ? "검증됨" : "미검증";
}

const server = new McpServer({ name: "checkup-skills", version: "0.1.0" });

// ── search_skills ─────────────────────────────────────────────────────────────
server.registerTool(
  "search_skills",
  {
    title: "스킬 검색",
    description: "claude-checkup 카탈로그(977+종)에서 이름·설명·카테고리로 스킬을 검색한다.",
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
    const matches = filterCatalog(catalog, query);
    if (matches.length === 0) {
      return textResult(
        `검색 결과 없음: "${query}" (0건). 다른 검색어를 시도하거나 ${SITE_URL} 에서 둘러보세요.`,
      );
    }
    const n = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const shown = matches.slice(0, n);
    const lines = [];
    shown.forEach((e, i) => {
      const cls = classifyInstall(e);
      const cat = e.category ? ` [${e.category}]` : "";
      lines.push(`${i + 1}. ${e.name}${cat}`);
      lines.push(`   ${truncate(e.description, DESC_MAX)}`);
      lines.push(`   출처: ${e.source ?? "미상"} · 설치유형: ${cls.kind} · ${badge(cls)}`);
    });
    lines.push("");
    lines.push(
      `전체 ${matches.length}건 중 ${shown.length}건 표시. 상세는 skill_info, 설치는 install_skill 도구를 쓰세요. (${SITE_URL})`,
    );
    return textResult(lines.join("\n"));
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
    const entry = findExact(catalog, name);
    if (!entry) {
      return textResult(
        `일치하는 스킬이 없습니다: "${name}". search_skills 도구로 먼저 검색하세요.`,
        true,
      );
    }
    const cls = classifyInstall(entry);
    const lines = [`■ ${entry.name}${entry.category ? ` [${entry.category}]` : ""}`];
    if (entry.collection) lines.push(`컬렉션: ${entry.collection}`);
    lines.push(`출처: ${entry.source ?? "미상"}`);
    lines.push(`라이선스: ${entry.install2?.license || "미상"}`);
    lines.push(`설치유형: ${cls.kind} · ${badge(cls)}`);
    lines.push("");
    lines.push(entry.description ?? "");
    lines.push("");
    lines.push("설치 명령:");
    for (const l of installLines(entry)) lines.push(`  ${l}`);

    // 예시 프롬프트 — best-effort(404/오류는 조용히 생략).
    const prompts = await fetchSamplePrompts(entry.name);
    if (prompts.length > 0) {
      lines.push("");
      lines.push("예시 프롬프트:");
      prompts.slice(0, MAX_SAMPLE_PROMPTS).forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    }
    return textResult(lines.join("\n"));
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
    const entry = findExact(catalog, name);
    if (!entry) {
      return textResult(
        `일치하는 스킬이 없습니다: "${name}". search_skills 도구로 먼저 검색하세요.`,
        true,
      );
    }
    const cls = classifyInstall(entry);

    // 미검증 → 거부(정상 응답, 크래시 아님. isError:false).
    if (!cls.verified) {
      const lines = [
        `설치 거부: "${entry.name}" 는 검증된 출처가 아닙니다 (설치유형: ${cls.kind}).`,
        `사유: ${cls.reason}`,
        `claude-checkup 출처 정책상, 미검증 출처는 원클릭 설치 명령을 제공하지 않습니다.`,
        `출처 정책: ${SOURCE_POLICY_URL}`,
        `출처(수동 검토용): ${entry.source ?? "미상"}`,
        `직접 확인 후 설치하려면 사이트에서 검토하세요: ${SITE_URL}`,
      ];
      return textResult(lines.join("\n"));
    }

    // 검증됨 → 정확한 설치 명령 반환. 어떤 셸도 대신 실행하지 않는다.
    const lines = [`검증됨: ${cls.kind}`, "", "설치 명령:"];
    for (const l of installLines(entry)) lines.push(`  ${l}`);
    lines.push("");
    lines.push(`출처: ${entry.source ?? "미상"}`);
    lines.push(`라이선스: ${entry.install2?.license || "미상"}`);
    lines.push("");
    lines.push(
      "안전 안내: marketplace 명령(`/plugin ...`)은 Claude Code에서 실행하는 슬래시 명령입니다. " +
        "내용을 검토한 뒤 직접 실행하세요. 이 도구는 어떤 셸/child_process도 대신 실행하지 않습니다.",
    );
    return textResult(lines.join("\n"));
  },
);

// ── 시작 ──────────────────────────────────────────────────────────────────────
try {
  await server.connect(new StdioServerTransport());
} catch (err) {
  // stderr로만(스타트업 실패). stdout은 JSON-RPC 채널이라 오염 금지.
  console.error("MCP 서버 시작 실패:", err?.message ?? String(err));
  process.exitCode = 1;
}
