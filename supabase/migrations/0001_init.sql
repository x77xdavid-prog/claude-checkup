-- claude-checkup 초기 스키마 (배포 필수).
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
--
-- 접근 모델: 서버(Next route)가 service_role 키로만 접근한다. service_role은 RLS를 우회(BYPASSRLS)하므로
--            아래 3개 테이블은 RLS를 켜되 anon/authenticated용 정책을 "하나도" 만들지 않는다
--            → PostgREST(anon/authenticated)로는 어떤 행도 읽거나 쓸 수 없다(기본 차단). 서버만 통과.

-- gen_random_uuid()용. Supabase 최신 프로젝트는 기본 활성이지만 방어적으로 보장.
create extension if not exists pgcrypto;

-- ── scans: 진단 결과 1건 = 결과 페이지 1개 ────────────────────────────────────
create table if not exists public.scans (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null    default now(),
  score_total int         not null,
  categories  jsonb       not null,   -- [{key,label,score,verdict}] — 서버 재계산 값
  meta        jsonb       not null    -- {v,totals,flags} 개수·불리언만(개인정보 최소화)
);

-- ── subscribers: 뉴스레터 대기자(멱등 — email이 pk) ───────────────────────────
create table if not exists public.subscribers (
  email       text        primary key,
  created_at  timestamptz not null    default now(),
  confirmed   boolean     not null    default false,
  unsub_token uuid        not null    default gen_random_uuid()
);

-- ── search_logs: 익명 검색 로그(프라이버시 우선 — IP·개인정보 없음) ────────────
create table if not exists public.search_logs (
  id             bigint      generated always as identity primary key,
  created_at     timestamptz not null default now(),
  query          text        not null,
  matched_usecase text,                 -- 매칭된 유스케이스 id(없으면 null = 신규 후보)
  result_count   int         not null
);

create index if not exists search_logs_created_at_idx on public.search_logs (created_at);

-- ── RLS: 전부 활성화 + anon/authenticated 정책 없음 = 기본 차단 ─────────────────
-- service_role(서버)만 접근. 정책을 추가하지 않는 것이 의도된 "전부 차단"이다.
alter table public.scans        enable row level security;
alter table public.subscribers  enable row level security;
alter table public.search_logs  enable row level security;

-- 방어적 명시: 만에 하나 기본 grant가 남아 있어도 anon/authenticated의 직접 접근을 회수.
revoke all on public.scans        from anon, authenticated;
revoke all on public.subscribers  from anon, authenticated;
revoke all on public.search_logs  from anon, authenticated;

-- ── (선택) scans 30일 후 자동 삭제 힌트 ───────────────────────────────────────
-- 결과 URL은 개인 진단이라 장기 보관 불필요. pg_cron 확장을 켜면 아래처럼 예약 가능(필수 아님):
--   create extension if not exists pg_cron;
--   select cron.schedule('purge-old-scans', '0 3 * * *',
--     $$ delete from public.scans where created_at < now() - interval '30 days' $$);
