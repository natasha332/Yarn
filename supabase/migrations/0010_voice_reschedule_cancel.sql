-- Yarn, milestone 4: rescheduling and cancelling a booking by voice.
-- "Move Priya's consult to Thursday at 2" now makes a "reschedule" card, and
-- "Cancel Dave's site visit" makes a "cancel" card. Tapping Confirm on one carries it out,
-- using the same all-or-nothing steps as the Reschedule and Cancel buttons (0009).
-- Only adds things: two new card types and an upgraded confirm_item. Nothing is deleted.

alter table public.items drop constraint items_type_check;
alter table public.items add constraint items_type_check
  check (type in ('calendar', 'todo', 'followup', 'note', 'job',
                  'invoice', 'quote', 'variation', 'reschedule', 'cancel'));

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
