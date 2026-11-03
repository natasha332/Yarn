-- Yarn, milestone 5 step 2: remember WHEN a to-do was ticked off, so the day wrap-up can say
-- "done today". Adds one column and one small automatic step. Safe to run once.
-- It changes no existing data: to-dos you already ticked simply have no "done" time
-- (so they won't be counted as done today).

alter table public.items add column done_at timestamptz;

-- Whenever an item is marked done, stamp the time. If it's un-done later, clear it.
create function private.set_done_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger items_done_at
  before update on public.items
  for each row execute function private.set_done_at();
