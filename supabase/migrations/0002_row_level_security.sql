-- Yarn, milestone 1 step 5: "you only see your own business".
-- Row-level security was switched on in 0001 with no rules, so nothing was readable.
-- This adds the rules. Safe to run once; it changes no data.

-- A small helper: which business does the logged-in person belong to?
-- It lives in a "private" schema so it can't be called from the app's public API.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select business_id from public.users where id = (select auth.uid())
$$;

revoke all on function private.current_business_id() from public, anon;
grant execute on function private.current_business_id() to authenticated;

-- Belt and braces: people who are not logged in get no access to these tables at all.
revoke all on public.businesses, public.users, public.clients, public.jobs from anon;

-- businesses: see and edit only your own. (Creating one happens during onboarding, step 6.)
create policy "see own business" on public.businesses
  for select to authenticated
  using (id = (select private.current_business_id()));

create policy "edit own business" on public.businesses
  for update to authenticated
  using (id = (select private.current_business_id()))
  with check (id = (select private.current_business_id()));

-- users: see the people in your business; edit only yourself, and you can't change business.
create policy "see people in own business" on public.users
  for select to authenticated
  using (business_id = (select private.current_business_id()));

create policy "edit myself" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and business_id = (select private.current_business_id()));

-- clients: full access, but only inside your own business.
create policy "own business clients" on public.clients
  for all to authenticated
  using (business_id = (select private.current_business_id()))
  with check (business_id = (select private.current_business_id()));

-- jobs: same, and a job can only be linked to a client from the same business.
create policy "own business jobs" on public.jobs
  for all to authenticated
  using (business_id = (select private.current_business_id()))
  with check (
    business_id = (select private.current_business_id())
    and (client_id is null
         or exists (select 1 from public.clients c
                    where c.id = client_id
                      and c.business_id = (select private.current_business_id())))
  );
