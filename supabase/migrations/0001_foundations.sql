-- Yarn, milestone 1 step 4: the four foundation tables.
-- Safe to run once on a new, empty project. It only CREATES things; it deletes nothing.

-- businesses: one row per tradie business
create table public.businesses (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  timezone          text not null default 'Australia/Sydney',
  morning_email_time time not null default '07:00',
  wrapup_mode       text not null default 'end_of_day',
  notify_channel    text not null default 'email'
                    check (notify_channel in ('email', 'push', 'both')),
  push_subscription jsonb,
  google_calendar_id text,
  plan              text not null default 'base'
                    check (plan in ('base', 'accounting', 'quoting')),
  trial_ends_at     timestamptz not null default (now() + interval '14 days'),
  created_at        timestamptz not null default now()
);

-- users: the person who logs in. id is the same id Supabase gives them at login.
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null default 'owner' check (role in ('owner')),
  created_at  timestamptz not null default now()
);

-- clients: the tradie's customers
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  aliases     text[] not null default '{}',   -- nicknames, so "Robyn" finds Robyn Clarke
  created_at  timestamptz not null default now()
);

-- jobs: a piece of work for a client
create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  name        text not null,
  address     text,
  status      text not null default 'quoted'
              check (status in ('quoted', 'booked', 'in_progress', 'done')),
  created_at  timestamptz not null default now()
);

-- indexes so lists stay fast
create index users_business_id_idx   on public.users   (business_id);
create index clients_business_id_idx on public.clients (business_id);
create index jobs_business_id_idx    on public.jobs    (business_id);
create index jobs_client_id_idx      on public.jobs    (client_id);

-- LOCK THE DOORS NOW: with row-level security on and no policies yet,
-- nobody can read or write these tables through the app until step 5
-- adds the "you only see your own business" rules.
alter table public.businesses enable row level security;
alter table public.users      enable row level security;
alter table public.clients    enable row level security;
alter table public.jobs       enable row level security;
