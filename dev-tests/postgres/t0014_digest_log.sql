\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A'),('bbbbbbbb-0000-0000-0000-00000000000b','B');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x'),('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b','B','b@x');
set role service_role;
\echo 1 first claim wins (expect t), second is refused (expect f)
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','morning','2026-11-03');
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','morning','2026-11-03');
\echo 2 different kind / different day / different business each get their own claim (expect t t t)
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','wrapup','2026-11-03'), public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','morning','2026-11-04'), public.claim_digest('bbbbbbbb-0000-0000-0000-00000000000b','morning','2026-11-03');
\echo 3 after a SENT it can never be claimed again (expect f)
update public.digest_log set status='sent', sent_at=now() where kind='morning' and local_date='2026-11-03' and business_id='aaaaaaaa-0000-0000-0000-00000000000a';
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','morning','2026-11-03');
\echo 4 a FAILED one can be retried (expect t, attempts 2), up to 3 attempts
update public.digest_log set status='failed' where kind='wrapup' and business_id='aaaaaaaa-0000-0000-0000-00000000000a';
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','wrapup','2026-11-03');
update public.digest_log set status='failed' where kind='wrapup' and business_id='aaaaaaaa-0000-0000-0000-00000000000a';
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','wrapup','2026-11-03');
update public.digest_log set status='failed' where kind='wrapup' and business_id='aaaaaaaa-0000-0000-0000-00000000000a';
\echo   third retry refused (expect f, attempts stays 3)
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','wrapup','2026-11-03');
select attempts from public.digest_log where kind='wrapup' and business_id='aaaaaaaa-0000-0000-0000-00000000000a';
\echo 5 a run that crashed mid-send (stuck "sending") is only retried after 10 minutes
select public.claim_digest('bbbbbbbb-0000-0000-0000-00000000000b','morning','2026-11-03') as too_soon_expect_f;
update public.digest_log set claimed_at = now() - interval '11 minutes' where business_id='bbbbbbbb-0000-0000-0000-00000000000b';
select public.claim_digest('bbbbbbbb-0000-0000-0000-00000000000b','morning','2026-11-03') as after_11_min_expect_t;
reset role;
\echo 6 people logged in can read only their own business rows, and cannot write
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
select business_id, kind, status from public.digest_log order by kind, local_date;
insert into public.digest_log (business_id,kind,local_date,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','morning','2030-01-01','sent');
update public.digest_log set status='sent';
select public.claim_digest('aaaaaaaa-0000-0000-0000-00000000000a','morning','2031-01-01');
reset role; set role anon; select * from public.digest_log;
