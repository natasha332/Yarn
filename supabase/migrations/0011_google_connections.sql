-- Yarn, milestone 4: connecting Google Calendar.
-- Adds one new table. It changes none of your existing data and is safe to run once.
--
-- It holds the "key" Google hands Yarn when you tap "Connect Google Calendar", so Yarn can add
-- and move events later without asking you to sign in again. The key is ENCRYPTED by the app
-- before it is saved here (the scrambling code lives only in Netlify's settings), so even
-- someone looking at this table in Supabase sees only gibberish.
--
-- One row per business. Only people in that business can see or change it.

create table public.google_connections (
  business_id       uuid primary key references public.businesses (id) on delete cascade,
  google_email      text,
  refresh_token_enc text not null,
  connected_at      timestamptz not null default now()
);

alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon;

create policy "own business google connection" on public.google_connections
  for all to authenticated
  using (business_id = (select private.current_business_id()))
  with check (business_id = (select private.current_business_id()));
