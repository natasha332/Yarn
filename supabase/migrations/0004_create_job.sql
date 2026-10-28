-- Yarn, milestone 1 step 8: save a job (and, if it's a new customer, the client) in one go.
-- All-or-nothing: if anything fails, nothing is saved, so you never get a half-made client.
-- It runs with YOUR permissions, so the row-level security rules from 0002 still apply.
-- The voice "Confirm" button will reuse this in milestone 3.

create or replace function public.create_job(
  job_name           text,
  job_status         text default 'quoted',
  job_address        text default null,
  existing_client_id uuid default null,
  client_name        text default null,
  client_phone       text default null,
  client_email       text default null,
  client_address     text default null,
  client_aliases     text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  biz        uuid := (select private.current_business_id());
  the_client uuid;
  new_job    uuid;
begin
  if biz is null then
    raise exception 'Please finish setting up your business first';
  end if;

  if length(trim(coalesce(job_name, ''))) = 0 or length(job_name) > 150 then
    raise exception 'Please give the job a name';
  end if;

  if existing_client_id is not null then
    -- Row-level security means this only finds clients in your own business.
    select id into the_client from public.clients where id = existing_client_id;
    if the_client is null then
      raise exception 'That client could not be found';
    end if;
  else
    if length(trim(coalesce(client_name, ''))) = 0 or length(client_name) > 100 then
      raise exception 'Please enter the client''s name';
    end if;
    insert into public.clients (business_id, name, phone, email, address, aliases)
    values (biz, trim(client_name), nullif(trim(client_phone), ''), nullif(trim(client_email), ''),
            nullif(trim(client_address), ''), coalesce(client_aliases, '{}'))
    returning id into the_client;
  end if;

  insert into public.jobs (business_id, client_id, name, address, status)
  values (biz, the_client, trim(job_name), nullif(trim(job_address), ''), job_status)
  returning id into new_job;

  return new_job;
end;
$$;

revoke all on function public.create_job(text, text, text, uuid, text, text, text, text, text[]) from public, anon;
grant execute on function public.create_job(text, text, text, uuid, text, text, text, text, text[]) to authenticated;
