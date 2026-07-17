-- claude-checkup 무료 API 키 (MCP 수익화 2단계) — 이메일 등록 시 상향 한도(분당 120) 무료 키 발급.
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
--
-- 접근 모델은 0001_init.sql·0002_cli_events.sql과 동일: 서버(Next route)가 service_role 키로만 접근한다.
-- RLS를 켜되 anon/authenticated용 정책을 하나도 만들지 않는다 → PostgREST로는 어떤 행도 읽거나 쓸 수 없다.
-- (이 테이블은 이메일·키 해시를 담으므로 anon 노출은 절대 금지. 키 원문은 저장하지 않는다 — sha256 해시만.)

-- ── api_keys: 무료/유료 API 키 (원문 미저장, sha256 해시가 pk) ────────────────────
create table if not exists public.api_keys (
  key_hash     text        primary key,               -- sha256(key) hex. 키 원문은 저장하지 않음
  email        text        not null,
  tier         text        not null default 'free' check (tier in ('free','paid')),
  verified     boolean     not null default false,     -- 이메일 확인 여부(RESEND 장착 후 더블옵트인 승격 예정)
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,                            -- MCP 검증 시 fire-and-forget 갱신
  revoked      boolean     not null default false,     -- 회수(관리 스크립트에서 true) — 검증 시 즉시 익명 폴백
  paid_until   timestamptz                             -- 유료 만료(3단계)
);

create index if not exists api_keys_email_idx on public.api_keys (email);

-- ── RLS: cli_events와 동일하게 전부 차단 + service_role만 통과 ─────────────────────
alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;
