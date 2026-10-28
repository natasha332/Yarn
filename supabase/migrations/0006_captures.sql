-- Yarn, milestone 2 step 1: somewhere to keep voice recordings and their transcripts.
-- Only CREATES things; deletes nothing. Safe to run once.

-- captures: one row per voice note
create table public.captures (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  audio_url   text,        -- where the recording is kept in storage (a path, not a public link)
  transcript  text,
  status      text not null default 'recorded'
              check (status in ('recorded', 'transcribed', 'sorted', 'failed')),
  created_at  timestamptz not null default now()
);

create index captures_business_created_idx on public.captures (business_id, created_at desc);

alter table public.captures enable row level security;
revoke all on public.captures from anon;

-- You can see, add, change and delete captures in your own business.
-- A new capture must be in YOUR name, in YOUR business.
create policy "see own business captures" on public.captures
  for select to authenticated
  using (business_id = (select private.current_business_id()));

create policy "add my own captures" on public.captures
  for insert to authenticated
  with check (business_id = (select private.current_business_id())
              and user_id = (select auth.uid()));

create policy "edit own business captures" on public.captures
  for update to authenticated
  using (business_id = (select private.current_business_id()))
  with check (business_id = (select private.current_business_id()));

create policy "delete own business captures" on public.captures
  for delete to authenticated
  using (business_id = (select private.current_business_id()));

-- A PRIVATE storage folder ("bucket") for the audio. Nobody can open a file by guessing its link.
-- Files are saved as  <business id>/<capture id>.<ext>  so the first folder name says whose it is.
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 26214400)   -- 25 MB, the most the transcription service accepts
on conflict (id) do nothing;

create policy "see own business audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'audio'
         and (storage.foldername(name))[1] = (select private.current_business_id())::text);

create policy "add audio to own business" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio'
              and (storage.foldername(name))[1] = (select private.current_business_id())::text);

create policy "delete own business audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio'
         and (storage.foldername(name))[1] = (select private.current_business_id())::text);
