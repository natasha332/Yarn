-- Yarn, milestone 3 step 3: tapping Confirm on a card.
-- One safe, all-or-nothing step. For a "New job" card it creates the client (if new) and the job,
-- then links any other cards from the same note (like the calendar booking) to that job.
-- It runs with YOUR permissions, so the "only your own business" rules still apply.

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
begin
  -- Row-level security means this only ever finds cards in your own business.
  select * into it from public.items where id = item_id for update;
  if not found then
    raise exception 'That card could not be found';
  end if;
  if it.status <> 'pending' then
    raise exception 'That card has already been dealt with';
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

  elsif it.type = 'calendar' and it.due_date is null then
    raise exception 'Add a date to this booking first';
  else
    update public.items set status = 'confirmed' where id = item_id;
  end if;
end;
$$;

revoke all on function public.confirm_item(uuid) from public, anon;
grant execute on function public.confirm_item(uuid) to authenticated;
