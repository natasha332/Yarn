-- Yarn, milestone 5 step 3: the log that stops anyone getting the same email twice.
-- Adds one table and one small function. Safe to run once; it changes no existing data.
--
-- Before each automatic email, Yarn "claims" it: one row per business, per kind of email
-- (morning / wrapup), per local day. If a row already exists, nobody else can claim it, so even
-- if the timer fires twice, or two runs overlap, only one email goes out. If sending fails the
-- claim is released so the next run (15 minutes later) can try again, up to 3 times.
--
-- Only Yarn's timer can write to this table. You can read your own business's rows.

create table public.digest_log (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        text not null check (kind in ('morning', 'wrapup')),
  local_date  date not null,
  status      text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  attempts    smallint not null default 1,
  to_email    text,
  error       text,
  claimed_at  timestamptz not null default now(),
  sent_at     timestamptz,
  primary key (business_id, kind, local_date)
);

alter table public.digest_log enable row level security;
revoke all on public.digest_log from anon, authenticated;
grant select on public.digest_log to authenticated;

create policy "see own business digest log" on public.digest_log
  for select to authenticated
  using (business_id = (select private.current_business_id()));

-- true = you got it (go ahead and send); false = already sent, or being sent, or given up.
create function public.claim_digest(p_business_id uuid, p_kind text, p_local_date date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed integer;
begin
  insert into public.digest_log (business_id, kind, local_date, status)
  values (p_business_id, p_kind, p_local_date, 'sending')
  on conflict (business_id, kind, local_date) do update
    set status     = 'sending',
        attempts   = public.digest_log.attempts + 1,
        claimed_at = now(),
        error      = null
    where public.digest_log.attempts < 3
      and (public.digest_log.status = 'failed'
           or (public.digest_log.status = 'sending'
               and public.digest_log.claimed_at < now() - interval '10 minutes'));
  get diagnostics claimed = row_count;
  return claimed > 0;
end;
$$;

revoke all on function public.claim_digest(uuid, text, date) from public, anon, authenticated;
grant execute on function public.claim_digest(uuid, text, date) to service_role;
