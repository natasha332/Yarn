-- Yarn, milestone 6: emailing clients from Yarn (for example "your booking has moved").
-- Only ADDS things; nothing you've entered is changed or deleted. Safe to run once.
--
--   businesses: three optional settings for how your emails look (name shown, where replies go, sign-off)
--   items: a new card type, "email"
--   confirm_item: now refuses to "confirm" an email, so an email can never be marked done without
--                 actually being sent. (Emails go out through the Send button.)
--   sent_emails: a record of every email Yarn sent for you, or tried to

alter table public.businesses
  add column email_from_name text,
  add column email_reply_to  text,
  add column email_sign_off  text;

alter table public.items drop constraint items_type_check;
alter table public.items add constraint items_type_check
  check (type in ('calendar', 'todo', 'followup', 'note', 'job',
                  'invoice', 'quote', 'variation', 'reschedule', 'cancel', 'email'));

create table public.sent_emails (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_id     uuid references public.items (id) on delete set null,
  client_id   uuid references public.clients (id) on delete set null,
  to_email    text not null,
  subject     text not null,
  status      text not null check (status in ('sent', 'failed')),
  resend_id   text,
  error       text,
  sent_at     timestamptz not null default now()
);

create index sent_emails_business_idx on public.sent_emails (business_id, sent_at desc);

alter table public.sent_emails enable row level security;
revoke all on public.sent_emails from anon;
revoke update, delete on public.sent_emails from authenticated;

create policy "see own business sent emails" on public.sent_emails
  for select to authenticated
  using (business_id = (select private.current_business_id()));

create policy "log emails in own business" on public.sent_emails
  for insert to authenticated
  with check (business_id = (select private.current_business_id()));

create or replace function public.confirm_item(item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it         public.items;
  nc         jsonb;
  the_job    uuid;
  the_client uuid;
  target_id  uuid;
begin
  -- Row-level security means this only ever finds cards in your own business.
  select * into it from public.items where id = item_id for update;
  if not found then
    raise exception 'That card could not be found';
  end if;
  if it.status <> 'pending' then
    raise exception 'That card has already been dealt with';
  end if;
  -- An email can only go out through the Send button, which actually sends it.
  if it.type = 'email' then
    raise exception 'Use Send to email this';
  end if;

  if it.type = 'job' then
    nc := it.details -> 'new_client';
    if it.client_id is null and nullif(trim(coalesce(nc ->> 'name', '')), '') is null then
      raise exception 'Choose or enter the client first';
    end if;

    the_job := public.create_job(
      job_name           := it.title,
      job_status         := coalesce(it.details ->> 'job_status', 'consultation'),
      job_address        := nullif(trim(coalesce(it.details ->> 'address', '')), ''),
      existing_client_id := it.client_id,
      client_name        := nc ->> 'name',
      client_phone       := nc ->> 'phone',
      client_email       := nc ->> 'email',
      client_address     := coalesce(nc ->> 'address', it.details ->> 'address'),
      client_aliases     := coalesce(array(select jsonb_array_elements_text(nc -> 'nicknames')), '{}')
    );
    select client_id into the_client from public.jobs where id = the_job;

    update public.items
       set status = 'confirmed', job_id = the_job, client_id = the_client
     where id = item_id;

    -- Other cards from the same note that were about this new job now point at it.
    if it.capture_id is not null then
      update public.items
         set job_id = the_job, client_id = coalesce(client_id, the_client)
       where capture_id = it.capture_id
         and id <> item_id
         and status in ('pending', 'confirmed')
         and (details ->> 'belongs_to_card') = it.position::text;
    end if;

  elsif it.type in ('reschedule', 'cancel') then
    -- Which booking? (the sorter picked one, or you chose it on the card)
    begin
      target_id := nullif(it.details ->> 'target_item_id', '')::uuid;
    exception when invalid_text_representation then
      target_id := null;
    end;
    if target_id is null then
      raise exception 'Choose which booking first';
    end if;

    if it.type = 'reschedule' then
      if it.due_date is null then
        raise exception 'Choose the new day first';
      end if;
      perform public.reschedule_booking(target_id, it.due_date, it.start_time, it.end_time);
    else
      perform public.cancel_booking(target_id);
    end if;

    update public.items set status = 'confirmed' where id = item_id;

  elsif it.type = 'calendar' and it.due_date is null then
    raise exception 'Add a date to this booking first';
  else
    update public.items set status = 'confirmed' where id = item_id;
  end if;
end;
$$;

revoke all on function public.confirm_item(uuid) from public, anon;
grant execute on function public.confirm_item(uuid) to authenticated;
