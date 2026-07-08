# checkup-skills-mcp

로컬 **stdio MCP 서버** PoC. [claude-checkup](https://claudecowork.co.kr) 스킬 카탈로그(977+종)를
어떤 MCP 호스트(Claude Code / Cursor / Claude Desktop)에서도 **에이전트 네이티브 도구**로 노출한다.
외부 상태 없이 카탈로그(`catalog.json`)와 예시 프롬프트 API를 실시간 조회한다.

`cli/`의 `checkup-skills` CLI와 같은 데이터 소스·판별 로직을 쓰되, MCP 서버는 독립 패키지다.

## 도구 3종

| 도구 | 설명 | 입력 |
|------|------|------|
| `search_skills` | 이름·설명·카테고리 부분일치 검색. 결과마다 출처·설치유형·검증여부 배지 표시. | `query: string`, `limit?: 1–50 (기본 10)` |
| `skill_info` | 스킬 1건 상세: 설명·출처·라이선스·설치 명령 + 예시 프롬프트(최대 5, best-effort). | `name: string` (정확 일치) |
| `install_skill` | **검증 게이트.** 검증된 출처만 설치 명령을 반환, 미검증은 거부. 셸을 실행하지 않는다. | `name: string` |

## 설치 (Claude Code)

```bash
claude mcp add checkup-skills -- node D:/프로젝트/claude-checkup/mcp/index.mjs
```

일반형(경로만 자기 환경에 맞게):

```bash
claude mcp add <서버이름> -- node /absolute/path/to/mcp/index.mjs
```

Cursor / Claude Desktop 등은 각 호스트의 MCP 설정(JSON)에 stdio 서버로 등록한다:

```json
{
  "mcpServers": {
    "checkup-skills": {
      "command": "node",
      "args": ["D:/프로젝트/claude-checkup/mcp/index.mjs"]
    }
  }
}
```

## 에이전트 사용 예

> "보안 스킬 검색해서 검증된 거 설치 명령 알려줘"

에이전트는 `search_skills {query:"보안"}` → 결과에서 검증된 스킬 선택 →
`install_skill {name:"..."}` 로 정확한 `/plugin ...` 명령을 받아 **사용자에게 제시**한다.
미검증 스킬을 고르면 `install_skill` 이 거부하고 출처 정책을 안내한다.

## 안전 모델 (핵심)

- **검증 전용 설치 게이트.** `install_skill` 은 `install2.kind` 가 `marketplace` 또는
  `verified-repo` 이고 설치 명령이 실제로 존재할 때만 명령을 반환한다.
  그 외(`unverified`, 빈 명령)는 **거부**하고
  [출처 정책](https://claudecowork.co.kr/ko/source-policy)과 원본 `source` 필드를 수동 검토용으로 보여준다.
- **묻지마 셸 실행 없음.** 이 서버는 어떤 `child_process`/셸도 실행하지 않는다.
  `marketplace` 명령(`/plugin ...`)은 Claude Code에서 사용자가 직접 실행하는 슬래시 명령으로 안내만 한다.
- **네트워크 오류에 안전.** 카탈로그/프롬프트 조회 실패는 도구가 `isError` 텍스트로 반환하며
  서버를 죽이지 않는다. 예시 프롬프트 404는 조용히 생략한다.

### 미래 확장: `allowExec` (의도적으로 미포함)

`verified-repo` 의 셸 설치 명령을 실제로 실행하는 기능은 **향후 옵트인 `allowExec` 확장**으로 남겨둔다.
이 PoC는 보안을 우선해 어떤 명령도 자동 실행하지 않는다 — 검증·표시까지만 한다.

## 개발 / 검증

```bash
npm install                 # 의존성: @modelcontextprotocol/sdk, zod
node lib.mjs --self-test    # 순수 함수(검색/판별/게이트) 자가 검증 (네트워크 없음)
npm test                    # = node test-client.mjs — 서버를 스폰해 3개 도구를 실제 호출
```

- `lib.mjs` — 순수 헬퍼 + 페처(카탈로그/프롬프트/설치 분류). MCP 의존 없음.
- `index.mjs` — MCP 서버(stdio). stdout은 JSON-RPC 채널이므로 로그를 쓰지 않는다.
- `test-client.mjs` — SDK `Client` 로 붙는 헤드리스 통합 테스트.

Node 18+ (ESM). npm 게시·git 커밋은 하지 않는 PoC.
