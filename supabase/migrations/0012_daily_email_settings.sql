-- Yarn, milestone 5 step 1: settings for the 7am briefing and the day wrap-up.
-- Adds two columns to businesses and one safety rule. Safe to run once; it changes no data
-- you've entered. (The other settings, the briefing time and email/push choice, already exist.)
--
--   morning_enabled  true = send the morning briefing, false = don't
--   wrapup_time      what time (in your timezone) the day wrap-up is sent. Default 5:00pm.
--   wrapup_mode      already existed: 'end_of_day' = send the wrap-up, 'off' = don't

alter table public.businesses
  add column morning_enabled boolean not null default true,
  add column wrapup_time     time    not null default '17:00';

alter table public.businesses
  add constraint businesses_wrapup_mode_check check (wrapup_mode in ('end_of_day', 'off'));
