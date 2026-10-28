-- Yarn, milestone 1 step 6: first-time setup.
-- A brand-new login belongs to no business, so the security rules from 0002 show it nothing.
-- This function creates the business AND links the person to it, in one safe step.
-- It only works for a logged-in person who has no business yet, and only for themselves.

create or replace function public.create_business(
  business_name text,
  owner_name    text,
  business_timezone text default 'Australia/Sydney'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  my_email  text;
  new_id    uuid;
begin
  if me is null then
    raise exception 'You need to be logged in';
  end if;

  if exists (select 1 from public.users where id = me) then
    raise exception 'You already have a business';
  end if;

  if length(trim(coalesce(business_name, ''))) = 0 or length(business_name) > 100 then
    raise exception 'Please enter a business name';
  end if;

  if length(trim(coalesce(owner_name, ''))) = 0 or length(owner_name) > 100 then
    raise exception 'Please enter your name';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = business_timezone) then
    raise exception 'Unknown timezone';
  end if;

  select email into my_email from auth.users where id = me;

  insert into public.businesses (name, timezone)
  values (trim(business_name), business_timezone)
  returning id into new_id;

  insert into public.users (id, business_id, name, email, role)
  values (me, new_id, trim(owner_name), coalesce(my_email, ''), 'owner');

  return new_id;
end;
$$;

-- Only logged-in people can call it.
revoke all on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;
