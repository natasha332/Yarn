\set ON_ERROR_STOP off
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A'),('bbbbbbbb-0000-0000-0000-00000000000b','B');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x'),('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b','B','b@x');
set role authenticated; set request.uid = '11111111-1111-1111-1111-111111111111';
\echo 1 own insert (expect INSERT 0 1)
insert into google_connections (business_id, google_email, refresh_token_enc) values ('aaaaaaaa-0000-0000-0000-00000000000a','a@gmail.com','v1.x.y.z');
\echo 2 insert for the other business (expect RLS error)
insert into google_connections (business_id, refresh_token_enc) values ('bbbbbbbb-0000-0000-0000-00000000000b','v1.x.y.z');
\echo 3 upsert own (expect INSERT 0 1, email changes)
insert into google_connections (business_id, google_email, refresh_token_enc) values ('aaaaaaaa-0000-0000-0000-00000000000a','new@gmail.com','v1.n.n.n') on conflict (business_id) do update set google_email=excluded.google_email, refresh_token_enc=excluded.refresh_token_enc;
select google_email, refresh_token_enc from google_connections;
reset role;
insert into google_connections (business_id, refresh_token_enc) values ('bbbbbbbb-0000-0000-0000-00000000000b','secret-b');
set role authenticated; set request.uid = '11111111-1111-1111-1111-111111111111';
\echo 4 A sees only own (expect 1 row)
select count(*) from google_connections;
\echo 5 A cannot delete B (expect DELETE 0 for B)
delete from google_connections where business_id='bbbbbbbb-0000-0000-0000-00000000000b';
\echo 6 A deletes own (expect DELETE 1)
delete from google_connections where business_id='aaaaaaaa-0000-0000-0000-00000000000a';
reset role; set role anon;
\echo 7 anon blocked (expect permission denied)
select * from google_connections;
reset role;
\echo 8 B row survived A deleting
select business_id from google_connections;
