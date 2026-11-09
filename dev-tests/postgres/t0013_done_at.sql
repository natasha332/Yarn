insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x');
insert into businesses (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','A');
insert into users values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','A','a@x');
insert into items (business_id,type,title,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','todo','Order hinges','confirmed'),('aaaaaaaa-0000-0000-0000-00000000000a','todo','Old one','done');
\echo 1 existing done item has no done_at (expect null)
select title, status, done_at is null as no_time from items order by title;
set role authenticated; set request.uid='11111111-1111-1111-1111-111111111111';
update items set status='done' where title='Order hinges';
\echo 2 ticking stamps the time (expect t)
select title, done_at is not null as stamped, now()-done_at < interval '5 seconds' as recent from items where title='Order hinges';
\echo 3 editing the title of a done item keeps the original time (expect t)
select done_at as t1 from items where title='Order hinges' \gset
update items set title='Order soft-close hinges' where title='Order hinges';
select done_at = :'t1' as unchanged from items where title='Order soft-close hinges';
\echo 4 un-doing clears it (expect t)
update items set status='confirmed' where title='Order soft-close hinges';
select done_at is null as cleared from items where title='Order soft-close hinges';
\echo 5 ticking the already-done old one again does not restamp (expect t)
update items set status='done' where title='Old one'; 
select done_at is not null as stamped_first_time from items where title='Old one';
