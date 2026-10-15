begin;
select set_config('cms_test.admin',gen_random_uuid()::text,true);
select set_config('cms_test.category','snapshot-'||gen_random_uuid()::text,true);
select set_config('cms_test.post',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) values(current_setting('cms_test.admin')::uuid,'authenticated','authenticated',current_setting('cms_test.category')||'@cms-test.invalid');
insert into public.categories(id,name,slug,sort_order) values(current_setting('cms_test.category'),current_setting('cms_test.category'),current_setting('cms_test.category'),99);
insert into public.posts(id,legacy_id,environment,title,slug,summary,content,legacy_article_html,category_id,status)
values(current_setting('cms_test.post')::uuid,'9999999999','preview','보존 테스트',current_setting('cms_test.category'),'짧은 설명','[{"type":"text","text":"보존할 본문"}]','<article><p>원본 HTML</p></article>',current_setting('cms_test.category'),'draft');
set local role anon;
do $$begin
 begin perform public.cms_admin_page_snapshot('preview','list');raise exception 'Anonymous snapshot accepted';exception when insufficient_privilege then null;end;
 begin perform public.cms_admin_identity();raise exception 'Anonymous identity accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('cms_test.admin'),true);
set local role authenticated;
do $$begin
 begin perform public.cms_admin_page_snapshot('preview','list');raise exception 'Non-admin snapshot accepted';exception when insufficient_privilege then null;end;
 begin perform public.cms_admin_identity();raise exception 'Non-admin identity accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.admin_users(user_id,username) values(current_setting('cms_test.admin')::uuid,'snapshot_fixture');
set local role authenticated;
do $$declare snapshot jsonb; full_post jsonb; summary jsonb; expected integer;
begin
 snapshot:=public.cms_admin_page_snapshot('preview','list');
 if snapshot->'user' is distinct from public.cms_admin_identity()then raise exception 'Identity mismatch';end if;
 select count(*) into expected from public.posts where environment='preview';
 if jsonb_array_length(snapshot->'posts')<>expected or snapshot->'user'->>'id'<>current_setting('cms_test.admin') or snapshot->'user' ? 'email' then raise exception 'Snapshot profile/count failed';end if;
 select p into summary from jsonb_array_elements(snapshot->'posts')p where p->>'id'=current_setting('cms_test.post');
 if summary is null or summary ? 'content' or summary ? 'legacy_article_html' or summary->>'category_id'<>current_setting('cms_test.category') then raise exception 'Minimal summary failed';end if;
 if snapshot->'statistics' ? 'daily' or snapshot->'statistics' is distinct from public.cms_admin_statistics('preview')-'daily' then raise exception 'Statistics mismatch';end if;
 snapshot:=public.cms_admin_page_snapshot('preview','editor',current_setting('cms_test.post'));
 full_post:=snapshot->'post';
 if full_post->'content'->0->>'text'<>'보존할 본문' or full_post->>'legacy_article_html'<>'<article><p>원본 HTML</p></article>' or jsonb_array_length(snapshot->'posts')<>0 or snapshot ? 'statistics' then raise exception 'Full editor body failed';end if;
 if public.cms_admin_page_snapshot('preview','editor','9999999999')->'post' is distinct from full_post then raise exception 'Legacy ID compatibility failed';end if;
 snapshot:=public.cms_admin_page_snapshot('preview','editor');
 if snapshot->'post'<>'null'::jsonb or snapshot ? 'statistics' then raise exception 'Empty editor failed';end if;
 snapshot:=public.cms_admin_page_snapshot('production','list');
 if exists(select 1 from jsonb_array_elements(snapshot->'posts')p where p->>'id'=current_setting('cms_test.post'))then raise exception 'Environments mixed';end if;
 begin perform public.cms_admin_page_snapshot('production','editor',current_setting('cms_test.post'));raise exception 'Wrong-environment post leaked';exception when no_data_found then null;end;
 begin perform public.cms_admin_page_snapshot('preview','invalid');raise exception 'Invalid view accepted';exception when invalid_parameter_value then null;end;
 begin perform public.cms_admin_page_snapshot('preview','editor','invalid');raise exception 'Invalid post ID accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
delete from public.admin_users where user_id=current_setting('cms_test.admin')::uuid;
set local role authenticated;
do $$begin
 begin perform public.cms_admin_page_snapshot('preview','list');raise exception 'Revoked admin accepted';exception when insufficient_privilege then null;end;
 begin perform public.cms_admin_identity();raise exception 'Revoked identity accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
