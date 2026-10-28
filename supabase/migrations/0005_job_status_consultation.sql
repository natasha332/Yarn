-- Yarn: add "consultation" as the first job status.
-- Statuses are now: consultation, quoted, booked, in_progress, done.
-- Existing jobs are untouched: every status they already use is still allowed.

alter table public.jobs drop constraint jobs_status_check;

alter table public.jobs add constraint jobs_status_check
  check (status in ('consultation', 'quoted', 'booked', 'in_progress', 'done'));
