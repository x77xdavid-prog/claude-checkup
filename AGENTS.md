# AGENTS.md — 에이전트 운용 (재정리판)

> 설치된 32개 에이전트(`~/.claude/agents`)를 **작업 단계별 파이프라인**으로 정리.
> 원칙: ① 단계에 맞는 에이전트를 쓴다 ② 독립 작업은 병렬로 ③ 작성과 검토는 다른 패스로 분리(자기 승인 금지).

## 파이프라인 (탐색 → 계획 → 구현 → 검토 → 출시)

| 단계 | 1순위 에이전트 | 언제 / 대안 |
|------|---------------|------------|
| **탐색** | `explore` · `code-explorer` | 코드/패턴 찾기. 깊은 추적은 `tracer` |
| **분석** | `analyst` (Opus) | 요구사항·사전 컨설팅 |
| **계획** | `planner` · `architect` | 복잡 기능·리팩터·시스템 설계. 청사진은 `code-architect` |
| **구현** | `executor` (복잡하면 `model=opus`) | 실제 코딩. 빌드 깨지면 `build-error-resolver` |
| **디자인** | `designer` | UI/UX 구현 |
| **검토** | `code-reviewer` · `security-reviewer` | 코드 작성 직후 **필수**. 언어별: `typescript-reviewer` `python-review` 등 |
| **품질** | `code-simplifier` · `refactor-cleaner` | 단순화·죽은코드 제거 |
| **검증** | `verifier` · `test-engineer` · `tdd-guide` | 완료 주장 전. 회귀는 `silent-failure-hunter` |
| **반론** | `critic` (Opus) | 계획/결과 다관점 공격 |
| **문서** | `writer` · `doc-updater` | README·코드맵 |
| **출시** | `git-master` · `e2e-runner` | 커밋·E2E |

## 라우팅 규칙
- **위임 대상:** 다중 파일 변경, 리팩터, 디버깅, 리뷰, 계획, 리서치, 검증.
- **직접 처리:** 사소한 1줄, 단일 명령, 작은 확인.
- **모델:** `haiku`=빠른 조회, `sonnet`=표준, `opus`=아키텍처/깊은 분석·보안.
- **병렬:** 독립 작업 2개+ 는 한 메시지에서 동시에 (예: 보안 리뷰 ∥ 성능 리뷰 ∥ 타입 체크).

## 철칙
- **자기 승인 금지** — 같은 컨텍스트에서 작성+승인 동시 금지. 검토는 `code-reviewer`/`verifier` 별도 패스.
- **보안 트리거** — 인증·결제·사용자입력·DB·파일·외부API·암호화 건드리면 `security-reviewer` 자동 호출.
- **증거 우선** — 검증 통과 못 하면 계속 반복, "됐다" 금지.
