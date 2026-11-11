\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A'),('bbbbbbbb-0000-0000-0000-00000000000b','B');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x'),('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b','B','b@x');
set role authenticated; set request.uid = '11111111-1111-1111-1111-111111111111';
\echo 1 add my own phone (expect INSERT 0 1)
insert into push_subscriptions (business_id, user_id, endpoint, p256dh, auth, device) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','https://push.example/a','p','a','Android Chrome');
\echo 2 add a phone for someone else in my business is refused (expect RLS error)
insert into push_subscriptions (business_id, user_id, endpoint, p256dh, auth) values ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','https://push.example/x','p','a');
\echo 3 add a phone to another business is refused (expect RLS error)
insert into push_subscriptions (business_id, user_id, endpoint, p256dh, auth) values ('bbbbbbbb-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111','https://push.example/y','p','a');
\echo 4 the same phone address twice is refused (expect duplicate key)
insert into push_subscriptions (business_id, user_id, endpoint, p256dh, auth) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','https://push.example/a','p','a');
\echo 5 the codes cannot be edited (expect permission denied)
update push_subscriptions set auth = 'changed';
reset role;
insert into push_subscriptions (business_id, user_id, endpoint, p256dh, auth) values ('bbbbbbbb-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','https://push.example/b','p','a');
set role authenticated; set request.uid = '11111111-1111-1111-1111-111111111111';
\echo 6 I see only my own business phones (expect 1)
select count(*) from push_subscriptions;
\echo 7 I cannot remove another business phone (expect DELETE 0), but can remove my own (expect DELETE 1)
delete from push_subscriptions where endpoint='https://push.example/b';
delete from push_subscriptions where endpoint='https://push.example/a';
reset role; set role anon;
\echo 8 logged-out people see nothing (expect permission denied)
select * from push_subscriptions;
reset role;
\echo 9 the other business kept its phone (expect 1)
select count(*) from push_subscriptions;
\echo 10 the briefing log can note how it was sent (expect INSERT 0 1 then email+push)
insert into digest_log (business_id, kind, local_date, status, channels) values ('aaaaaaaa-0000-0000-0000-00000000000a','morning','2026-11-03','sent','email+push');
select channels from digest_log;
