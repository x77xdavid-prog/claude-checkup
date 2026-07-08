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

## 고지

This is an independent project, not affiliated with Anthropic. Claude is a trademark of Anthropic, PBC.

본 프로젝트는 Anthropic과 제휴 관계가 없는 독립 프로젝트입니다. Claude는 Anthropic, PBC의 상표입니다.

전체 카탈로그: https://claudecowork.co.kr
