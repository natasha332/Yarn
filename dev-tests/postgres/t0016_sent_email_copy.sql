\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x');
\echo 1 existing businesses get the copy setting ON (expect t)
select email_copy_to_me from businesses;
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
\echo 2 it can be switched off on your own business (expect UPDATE 1)
update businesses set email_copy_to_me=false where id='aaaaaaaa-0000-0000-0000-00000000000a';
select email_copy_to_me from businesses;
\echo 3 the sent-email log keeps the text (expect INSERT 0 1, then the body)
insert into sent_emails (business_id,to_email,subject,status,body) values ('aaaaaaaa-0000-0000-0000-00000000000a','r@x.com','Hi','sent','Hi Robyn, your quote is ready.');
select body from sent_emails;
\echo 4 older log rows without text still work (expect INSERT 0 1)
insert into sent_emails (business_id,to_email,subject,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','r@x.com','Older','sent');
