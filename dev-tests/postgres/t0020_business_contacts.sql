insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A'),('bbbbbbbb-0000-0000-0000-00000000000b','B');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x'),('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b','B','b@x');
insert into clients (id,business_id,name) values ('c1111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','Old Dave');
insert into jobs (business_id,client_id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','c1111111-0000-0000-0000-000000000001','Kitchen');
\echo 1 an existing client is a client with no role (expect client, t)
select kind, role is null as no_role from clients where name='Old Dave';
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
\echo 2 add a business contact (expect Sam Lee, contact, Accountant)
insert into clients (business_id,name,kind,role) values ('aaaaaaaa-0000-0000-0000-00000000000a','Sam Lee','contact','Accountant');
select name, kind, role from clients where name='Sam Lee';
\echo 3 kind must be client or contact (expect ERROR violates check constraint)
insert into clients (business_id,name,kind) values ('aaaaaaaa-0000-0000-0000-00000000000a','X','supplier');
\echo 4 role is capped at 60 characters (expect ERROR violates check constraint)
insert into clients (business_id,name,kind,role) values ('aaaaaaaa-0000-0000-0000-00000000000a','X','contact',repeat('a',61));
\echo 5 a job cannot be given to a business contact (expect ERROR Business contacts cant have jobs)
insert into jobs (business_id,client_id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a',(select id from clients where name='Sam Lee'),'Nope');
\echo 6 an existing job cannot be moved to a business contact (expect ERROR)
update jobs set client_id=(select id from clients where name='Sam Lee') where name='Kitchen';
\echo 7 a client who has jobs cannot become a business contact (expect ERROR This client has jobs)
update clients set kind='contact' where name='Old Dave';
\echo 8 a client with no jobs can switch both ways (expect contact then client)
insert into clients (business_id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','Switcher');
update clients set kind='contact', role='Supplier' where name='Switcher';
select kind from clients where name='Switcher';
update clients set kind='client', role=null where name='Switcher';
select kind from clients where name='Switcher';
\echo 9 ordinary jobs for clients still work (expect 1)
insert into jobs (business_id,client_id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a',(select id from clients where name='Old Dave'),'Laundry');
select count(*) from jobs where name='Laundry';
\echo 10 another business cannot see these people (expect 0)
set request.uid='22222222-2222-2222-2222-222222222222';
select count(*) from clients;
