begin;
select set_config('cms_test.category','cms-fixture-'||gen_random_uuid()::text,true);
insert into public.categories(id,name,slug,sort_order) values(current_setting('cms_test.category'),current_setting('cms_test.category'),current_setting('cms_test.category'),99);
insert into public.posts(environment,title,slug,summary,content,category_id,status,published_at,view_count)
select 'preview','순서 '||n,current_setting('cms_test.category')||'-'||n,repeat('가',120),'[{"type":"text","text":"본문"}]',current_setting('cms_test.category'),'published',now()-make_interval(days=>16-n),16-n from generate_series(1,15)n;
insert into public.posts(environment,title,slug,summary,content,category_id,status) values('production','운영 분리',current_setting('cms_test.category')||'-1',repeat('가',120),'[{"type":"text","text":"본문"}]',current_setting('cms_test.category'),'published');
set local role anon;
do $$
declare recent jsonb; popular jsonb; second_page jsonb; prod jsonb;
begin
 recent:=public.cms_public_posts('preview',current_setting('cms_test.category'),'recent',1);
 popular:=public.cms_public_posts('preview',current_setting('cms_test.category'),'popular',1);
 second_page:=public.cms_public_posts('preview',current_setting('cms_test.category'),'recent',2);
 prod:=public.cms_public_posts('production',current_setting('cms_test.category'),'recent',1);
 if (recent->>'total')::integer<>15 or jsonb_array_length(recent->'posts')<>12 or jsonb_array_length(second_page->'posts')<>3 then raise exception 'Category paging/count failed'; end if;
 if recent->'posts'->0->>'title'<>'순서 15' or popular->'posts'->0->>'title'<>'순서 1' then raise exception 'Recent/popular order failed'; end if;
 if (prod->>'total')::integer<>1 then raise exception 'Environment isolation failed'; end if;
end $$;
reset role;
update public.posts set slug=slug||'-변경' where environment='preview' and category_id=current_setting('cms_test.category') and title='순서 1';
set local role anon;
do $$ begin if not exists(select 1 from public.post_slug_aliases where slug=current_setting('cms_test.category')||'-1') then raise exception 'Public old URL missing'; end if; end $$;
reset role;
update public.posts set status='private' where environment='preview' and category_id=current_setting('cms_test.category') and title='순서 1';
set local role anon;
do $$ begin if exists(select 1 from public.post_slug_aliases where slug=current_setting('cms_test.category')||'-1') then raise exception 'Private alias leaked'; end if; end $$;
reset role;
rollback;
