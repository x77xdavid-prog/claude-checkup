# checkup-skills

Claude Code 스킬 카탈로그(977+종) 검색 CLI. claudecowork.co.kr 라이브 데이터를 그 자리에서 검색합니다.

## 설치 없이 실행

```bash
npx checkup-skills commit
npx checkup-skills info glass-dark-ui
npx checkup-skills --help
```

## 무엇을 하나

- 이름·설명·카테고리 부분일치 검색 → 상위 10건 + 설치 명령
- `info <이름>`으로 정확 일치 상세(설명 전문·출처·라이선스·설치 명령)
- 외부 의존성 0, Node 18+ 내장 fetch만 사용

## 로드맵

- `add <이름>` — 카탈로그 항목을 `~/.claude/skills/`에 바로 설치하는 명령 예정.

## 텔레메트리

카탈로그 개선을 위해 익명 사용 통계를 수집합니다 — 검색어/스킬명(최대 120자)·CLI 버전·대략적 로케일·시각뿐입니다.
**IP·머신 ID·경로·사용자명 등은 절대 수집하지 않습니다.** 최초 실행 시 안내가 한 번 출력됩니다.

끄기:

```bash
CHECKUP_TELEMETRY=0 npx checkup-skills commit
```

표준 `DO_NOT_TRACK=1` 환경변수도 동작하며, `CI` 환경변수가 설정된 경우 자동으로 꺼집니다.

## 고지

This is an independent project, not affiliated with Anthropic. Claude is a trademark of Anthropic, PBC.

본 프로젝트는 Anthropic과 제휴 관계가 없는 독립 프로젝트입니다. Claude는 Anthropic, PBC의 상표입니다.

이 CLI 코드는 MIT지만, 조회되는 카탈로그 데이터(큐레이션)는 별도로 CC BY-NC 라이선스입니다 — [LICENSE-DATA.md](../LICENSE-DATA.md) 참고.

전체 카탈로그: https://claudecowork.co.kr
