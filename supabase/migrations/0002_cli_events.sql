-- claude-checkup CLI 텔레메트리 (checkup-skills CLI v0.2.0+) — 익명 사용 통계.
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
--
-- 접근 모델은 0001_init.sql과 동일: 서버(Next route)가 service_role 키로만 접근한다.
-- RLS를 켜되 anon/authenticated용 정책을 하나도 만들지 않는다 → PostgREST로는 어떤 행도 읽거나 쓸 수 없다.

-- ── cli_events: CLI 텔레메트리(프라이버시 우선 — IP·머신ID·경로 없음) ────────────
create table if not exists public.cli_events (
  id          bigint      generated always as identity primary key,
  event       text        not null,   -- "search" | "info" (검증은 app 레이어의 zod에서)
  value       text        not null,   -- 검색어 또는 스킬명(CLI에서 이미 120자로 절단됨)
  cli_version text        not null,
  locale      text,                   -- 대략적 로케일(예: ko_KR) — 없으면 null
  created_at  timestamptz not null default now()  -- 서버 시각(클라이언트가 보낸 ts는 신뢰하지 않음)
);

create index if not exists cli_events_created_at_idx on public.cli_events (created_at);

-- ── RLS: search_logs와 동일하게 전부 차단 + service_role만 통과 ─────────────────
alter table public.cli_events enable row level security;
revoke all on public.cli_events from anon, authenticated;
