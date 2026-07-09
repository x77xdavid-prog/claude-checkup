// checkup-skills-mcp — 실제 헤드리스 통합 테스트.
// SDK Client를 stdio로 붙여 `node index.mjs` 서버를 스폰하고, 3개 도구를 라이브 카탈로그로 호출한다.
// 모든 assert 통과 시 exit 0, 실패 시 non-zero + 메시지. 끝에서 전송을 닫는다.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const indexPath = fileURLToPath(new URL("./index.mjs", import.meta.url));
const cwd = fileURLToPath(new URL(".", import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT 실패: " + msg);
}

function getText(res) {
  assert(res && Array.isArray(res.content), "결과에 content 배열이 없음");
  return res.content
    .filter((c) => c && c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

// search_skills 텍스트를 블록 단위로 파싱 → [{ rank, name, kind }].
function parseSearch(text) {
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^(\d+)\.\s+(.+?)(?:\s+\[[^\]]*\])?\s*$/);
    if (m) {
      cur = { rank: Number(m[1]), name: m[2].trim(), kind: null };
      out.push(cur);
      continue;
    }
    const k = line.match(/설치유형:\s*(\S+)/);
    if (k && cur) cur.kind = k[1];
  }
  return out;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [indexPath],
  cwd,
  stderr: "inherit",
});
const client = new Client({ name: "checkup-skills-test-client", version: "0.0.0" }, { capabilities: {} });

let failed = false;
try {
  await client.connect(transport);

  // 1) tools/list — 정확히 4개 도구 확인.
  const listed = await client.listTools();
  const names = (listed.tools ?? []).map((t) => t.name).sort();
  console.log("=== tools/list ===");
  console.log(names.join(", "));
  const expected = ["install_skill", "search_skills", "skill_info", "whats_new"];
  assert(names.length === 4, `도구는 정확히 4개여야 함 (실제 ${names.length})`);
  for (const e of expected) assert(names.includes(e), `도구 누락: ${e}`);

  // 2) search_skills {query:"보안"} — 결과 ≥1, 첫 결과 이름 동적 캡처.
  const searchRes = await client.callTool({ name: "search_skills", arguments: { query: "보안", limit: 50 } });
  const searchText = getText(searchRes);
  console.log("\n=== search_skills {query:'보안', limit:50} ===");
  console.log(searchText.trim());
  assert(!searchRes.isError, "search_skills가 오류를 반환하면 안 됨");
  assert(searchText.trim().length > 0, "search_skills 텍스트가 비어있음");
  const parsed = parseSearch(searchText);
  assert(parsed.length >= 1, "검색 결과가 1건 이상이어야 함");
  const firstName = parsed[0].name;
  assert(firstName && firstName.length > 0, "첫 결과 이름을 파싱하지 못함");
  const unverified = parsed.find((p) => p.kind === "unverified");
  const installTarget = unverified?.name ?? firstName;

  // 3) skill_info {name:<discovered>} — 상세 반환 확인.
  const infoRes = await client.callTool({ name: "skill_info", arguments: { name: firstName } });
  const infoText = getText(infoRes);
  console.log(`\n=== skill_info {name:'${firstName}'} ===`);
  console.log(infoText.trim());
  assert(!infoRes.isError, "skill_info가 오류를 반환하면 안 됨");
  assert(infoText.includes(firstName), "상세에 스킬 이름이 포함돼야 함");
  assert(/출처:/.test(infoText) && /설치 명령:/.test(infoText), "상세에 출처/설치 명령이 포함돼야 함");

  // 4) install_skill — 미검증 대상이 있으면 그것으로(거부 경로 실증), 없으면 첫 결과.
  const instRes = await client.callTool({ name: "install_skill", arguments: { name: installTarget } });
  const instText = getText(instRes);
  console.log(`\n=== install_skill {name:'${installTarget}'} ${unverified ? "(미검증 대상)" : "(검증 대상)"} ===`);
  console.log(instText.trim());
  assert(instText.trim().length > 0, "install_skill 텍스트가 비어있음");
  if (unverified) {
    assert(/설치 거부/.test(instText), "미검증 스킬은 '설치 거부' 문구를 포함해야 함");
    assert(/source-policy|출처 정책/.test(instText), "거부 응답은 출처 정책을 안내해야 함");
  } else {
    assert(/검증됨/.test(instText), "검증 스킬은 '검증됨' 문구를 포함해야 함");
  }

  console.log("\nALL ASSERTS PASSED");
} catch (err) {
  failed = true;
  console.error("\nTEST FAILED:", err?.message ?? String(err));
} finally {
  try {
    await client.close();
  } catch {
    // 무시 — 이미 닫힘/종료
  }
}
process.exit(failed ? 1 : 0);
