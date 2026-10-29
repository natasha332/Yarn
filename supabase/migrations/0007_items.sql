-- Yarn, milestone 3 step 1: "items" are the cards the AI makes from a voice note.
-- Only CREATES things; deletes nothing. Safe to run once.

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  capture_id  uuid references public.captures (id) on delete set null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type        text not null
              check (type in ('calendar', 'todo', 'followup', 'note', 'job',
                              'invoice', 'quote', 'variation')),
  title       text not null,
  client_id   uuid references public.clients (id) on delete set null,
  job_id      uuid references public.jobs (id) on delete set null,
  due_date    date,
  start_time  time,          -- local time in the business's timezone, e.g. 09:00
  end_time    time,
  details     jsonb not null default '{}'::jsonb,   -- the extras for each kind of card
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'discarded', 'done')),
  external_id text,          -- for example the Google Calendar event, later
  position    smallint not null default 0,          -- order the cards were made in
  created_at  timestamptz not null default now()
);

create index items_business_status_idx on public.items (business_id, status);
create index items_capture_idx on public.items (capture_id);

alter table public.items enable row level security;
revoke all on public.items from anon;

-- Only inside your own business, and a card can only point at YOUR note, client and job.
create policy "see own business items" on public.items
  for select to authenticated
  using (business_id = (select private.current_business_id()));

create policy "add items in own business" on public.items
  for insert to authenticated
  with check (
    business_id = (select private.current_business_id())
    and (capture_id is null or exists (select 1 from public.captures c where c.id = capture_id))
    and (client_id is null or exists (select 1 from public.clients c where c.id = client_id))
    and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id))
  );

create policy "edit own business items" on public.items
  for update to authenticated
  using (business_id = (select private.current_business_id()))
  with check (
    business_id = (select private.current_business_id())
    and (capture_id is null or exists (select 1 from public.captures c where c.id = capture_id))
    and (client_id is null or exists (select 1 from public.clients c where c.id = client_id))
    and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id))
  );

create policy "delete own business items" on public.items
  for delete to authenticated
  using (business_id = (select private.current_business_id()));

-- Deleting a voice note also deletes its cards that were never confirmed.
-- Cards you DID confirm stay (they just stop pointing at the deleted note).
create or replace function private.forget_unconfirmed_items()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.items
  where capture_id = old.id and status in ('pending', 'discarded');
  return old;
end;
$$;

create trigger captures_forget_unconfirmed_items
  before delete on public.captures
  for each row execute function private.forget_unconfirmed_items();
