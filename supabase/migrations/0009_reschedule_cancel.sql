-- Yarn, milestone 4: moving and cancelling a booking you've already confirmed.
-- Each one is a single safe step. They run with YOUR permissions, so the
-- "only your own business" rules still apply. Nothing is deleted: a cancelled booking
-- is kept as a record, marked cancelled, and just stops showing on Today.
--
-- If the booking already has a Google Calendar event, we note that the event needs updating
-- or removing. (The Google step clears that note once it has done it.)

create or replace function public.reschedule_booking(
  item_id   uuid,
  new_date  date,
  new_start time default null,
  new_end   time default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = item_id for update;
  if not found then
    raise exception 'That booking could not be found';
  end if;
  if it.type <> 'calendar' or it.status <> 'confirmed' then
    raise exception 'Only a confirmed booking can be moved';
  end if;
  if new_date is null then
    raise exception 'Choose a new day';
  end if;
  if new_end is not null and new_start is null then
    raise exception 'Add a start time as well as an end time';
  end if;
  if new_end is not null and new_end <= new_start then
    raise exception 'The end time has to be after the start time';
  end if;

  update public.items
     set due_date   = new_date,
         start_time = new_start,
         end_time   = new_end,
         details    = case
                        when it.external_id is not null
                          then it.details || jsonb_build_object('calendar_sync', 'needs_update')
                        else it.details
                      end
   where id = item_id;
end;
$$;

create or replace function public.cancel_booking(item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = item_id for update;
  if not found then
    raise exception 'That booking could not be found';
  end if;
  if it.type <> 'calendar' or it.status <> 'confirmed' then
    raise exception 'Only a confirmed booking can be cancelled';
  end if;

  update public.items
     set status  = 'discarded',
         details = it.details
                   || jsonb_build_object('cancelled_at', now())
                   || case when it.external_id is not null
                           then jsonb_build_object('calendar_sync', 'needs_delete')
                           else '{}'::jsonb end
   where id = item_id;
end;
$$;

revoke all on function public.reschedule_booking(uuid, date, time, time) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.reschedule_booking(uuid, date, time, time) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
