-- Yarn: a heartbeat, so you can be told if the 15-minute timer ever stops.
-- Adds one small table. Changes nothing you've entered. Safe to run once.
--
-- Each time the timer runs it writes the time here. A health address (/api/health) reads it, and a free
-- monitoring service can email you when the time gets too old.
-- Only Yarn's own timer can read or write it: nobody who logs in to Yarn can see it.

create table public.system_status (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.system_status enable row level security;
revoke all on public.system_status from anon, authenticated;
