\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A'),('bbbbbbbb-0000-0000-0000-00000000000b','B');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x'),('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b','B','b@x');
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
\echo 1 an email card can be saved (expect INSERT 0 1)
insert into items (business_id,type,title,status,details) values ('aaaaaaaa-0000-0000-0000-00000000000a','email','Moving our booking','pending','{"email":{"to":"r@x.com"}}');
\echo 2 confirm_item REFUSES an email so it can never be marked done unsent (expect error)
select public.confirm_item(id) from items where type='email';
select status from items where type='email';
\echo 3 other card types still confirm (expect t / confirmed)
insert into items (business_id,type,title,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','todo','Order hinges','pending');
select public.confirm_item(id) is not null as ok from items where type='todo';
select status from items where type='todo';
\echo 4 an unknown type is still refused (expect check violation)
insert into items (business_id,type,title,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','bogus','x','pending');
\echo 5 sender settings can be saved on your own business (expect UPDATE 1)
update businesses set email_from_name='Tabrez - A', email_reply_to='t@a.com', email_sign_off='Tabrez' where id='aaaaaaaa-0000-0000-0000-00000000000a';
\echo 6 sent_emails: log own business (expect INSERT 0 1), other business refused (expect RLS error)
insert into sent_emails (business_id,to_email,subject,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','r@x.com','Hi','sent');
insert into sent_emails (business_id,to_email,subject,status) values ('bbbbbbbb-0000-0000-0000-00000000000b','r@x.com','Hi','sent');
\echo 7 log cannot be edited or deleted (expect permission denied x2)
update sent_emails set subject='changed';
delete from sent_emails;
\echo 8 bad status refused (expect check violation)
insert into sent_emails (business_id,to_email,subject,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','r@x.com','Hi','weird');
\echo 9 you see only your own log (expect 1)
reset role; insert into sent_emails (business_id,to_email,subject,status) values ('bbbbbbbb-0000-0000-0000-00000000000b','z@x.com','Other','sent');
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
select count(*) from sent_emails;
reset role; set role anon; select * from sent_emails;
