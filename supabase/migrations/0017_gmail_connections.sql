-- Yarn: connecting Gmail, so Yarn can find an email you want to reply to and save the reply
-- as a DRAFT in your Gmail. Adds one new table; changes nothing you've entered. Safe to run once.
--
-- Same idea as google_connections (Calendar): the long-lived key Google gives Yarn is ENCRYPTED by
-- the app before it is saved, so even someone looking at this table sees only gibberish.
-- The key only allows reading mail and creating drafts. It cannot send anything.
-- One row per business. Only people in that business can see or change it.

create table public.gmail_connections (
  business_id       uuid primary key references public.businesses (id) on delete cascade,
  google_email      text,
  refresh_token_enc text not null,
  connected_at      timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from anon;

create policy "own business gmail connection" on public.gmail_connections
  for all to authenticated
  using (business_id = (select private.current_business_id()))
  with check (business_id = (select private.current_business_id()));
