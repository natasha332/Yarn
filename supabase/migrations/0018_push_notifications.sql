-- Yarn: push notifications (the lock-screen version of the briefing and wrap-up).
-- Adds one table and one column. Changes nothing you've entered. Safe to run once.
--
-- push_subscriptions: one row per phone or computer that has turned notifications on. It holds the
--   "address" the phone's own push service gave Yarn, plus two codes used to scramble each message so
--   only that device can read it. Those codes don't let anyone log in to anything.
-- digest_log.channels: a note of how each briefing went out (email, push, or both).

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  device      text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_business_idx on public.push_subscriptions (business_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke update on public.push_subscriptions from authenticated;

create policy "see own business devices" on public.push_subscriptions
  for select to authenticated
  using (business_id = (select private.current_business_id()));

create policy "add my own device" on public.push_subscriptions
  for insert to authenticated
  with check (
    business_id = (select private.current_business_id())
    and user_id = (select auth.uid())
  );

create policy "remove own business devices" on public.push_subscriptions
  for delete to authenticated
  using (business_id = (select private.current_business_id()));

alter table public.digest_log add column channels text;
