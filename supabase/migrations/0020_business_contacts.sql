-- Yarn: Business contacts (your accountant, suppliers, sales reps...) next to your clients (customers).
-- Adds two columns to the clients table and two small safety checks. Safe to run once.
--
-- Everyone already in your list stays a "client": nothing you've entered changes.
--   kind: 'client' (a customer) or 'contact' (a business contact)
--   role: for contacts, what they are to you, e.g. "Accountant", "Timber supplier", "Sales rep"
--
-- The safety checks keep the rule "business contacts don't have jobs":
--   * a job can't be given to a business contact
--   * a client who already has jobs can't be switched to a business contact

alter table public.clients
  add column kind text not null default 'client' check (kind in ('client', 'contact')),
  add column role text check (role is null or char_length(role) <= 60);

create function private.job_needs_a_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is not null
     and exists (select 1 from public.clients c where c.id = new.client_id and c.kind = 'contact') then
    raise exception 'Business contacts can''t have jobs. Pick a client.';
  end if;
  return new;
end;
$$;

create trigger jobs_client_is_a_client
  before insert or update of client_id on public.jobs
  for each row execute function private.job_needs_a_client();

create function private.client_with_jobs_stays_a_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'contact' and old.kind is distinct from 'contact'
     and exists (select 1 from public.jobs j where j.client_id = new.id) then
    raise exception 'This client has jobs, so they can''t be a business contact.';
  end if;
  return new;
end;
$$;

create trigger clients_with_jobs_stay_clients
  before update of kind on public.clients
  for each row execute function private.client_with_jobs_stays_a_client();
