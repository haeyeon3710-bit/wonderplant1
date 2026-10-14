begin;
select set_config('cms_test.cache_id',gen_random_uuid()::text,true);
insert into public.categories(id,name,slug,sort_order)values('cache-fixture','Cache fixture','cache-fixture',999);
select set_config('cms_test.revision',public.cms_public_revision('preview'),true),set_config('cms_test.production_revision',public.cms_public_revision('production'),true);
insert into public.posts(id,environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status)
values(current_setting('cms_test.cache_id')::uuid,'preview','Cache draft','cache-'||current_setting('cms_test.cache_id'),'','[{"type":"text","text":"Cache body"}]','/images/lifespan.png','Image','cache-fixture','draft');
do $$begin
 if public.cms_public_revision('preview')<>current_setting('cms_test.revision')then raise exception 'Private drafts expose revision activity';end if;
end $$;
update public.posts set status='published' where id=current_setting('cms_test.cache_id')::uuid;
do $$begin
 if public.cms_public_revision('preview')::bigint<>current_setting('cms_test.revision')::bigint+1 then raise exception 'Publication did not invalidate';end if;
 if public.cms_public_revision('production')<>current_setting('cms_test.production_revision')then raise exception 'Post environments mixed';end if;
end $$;
set local role anon;
do $$declare result jsonb;begin
 result:=public.cms_public_snapshot('preview','article','cache-'||current_setting('cms_test.cache_id'));
 if result->'data'->'post'->>'title'<>'Cache draft' then raise exception 'Snapshot missing publication';end if;
 if result->'data'->'overview' is null then raise exception 'Combined article overview missing';end if;
 begin update public.cms_public_revisions set revision=999;raise exception 'Anonymous revision write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('cms_test.revision',public.cms_public_revision('preview'),true);
update public.posts set view_count=view_count+1 where id=current_setting('cms_test.cache_id')::uuid;
do $$begin if public.cms_public_revision('preview')<>current_setting('cms_test.revision')then raise exception 'View traffic churns content cache';end if;end $$;
update public.posts set title='Edited',slug='edited-'||current_setting('cms_test.cache_id') where id=current_setting('cms_test.cache_id')::uuid;
set local role anon;
do $$declare result jsonb;begin
 result:=public.cms_public_snapshot('preview','article','cache-'||current_setting('cms_test.cache_id'));
 if result->'data'->>'redirect'<>'true' then raise exception 'Alias broken';end if;
end $$;
reset role;
update public.posts set status='private' where id=current_setting('cms_test.cache_id')::uuid;
set local role anon;
do $$begin
 if public.cms_public_snapshot('preview','article','edited-'||current_setting('cms_test.cache_id'))->'data'->>'post' is not null then raise exception 'Private snapshot leaked';end if;
 if public.cms_public_snapshot('preview','article','cache-'||current_setting('cms_test.cache_id'))->'data'->>'post' is not null then raise exception 'Private alias leaked';end if;
end $$;
reset role;
update public.posts set status='scheduled',scheduled_at=clock_timestamp()+interval '1 hour' where id=current_setting('cms_test.cache_id')::uuid;
select set_config('cms_test.revision',public.cms_public_revision('preview'),true);
-- The scheduled worker performs this same publication update in its transaction.
update public.posts set status='published' where id=current_setting('cms_test.cache_id')::uuid;
do $$begin if public.cms_public_revision('preview')::bigint<>current_setting('cms_test.revision')::bigint+1 then raise exception 'Scheduled publication did not invalidate';end if;end $$;
update public.categories set is_active=false where id='cache-fixture';
set local role anon;
do $$begin
 if public.cms_public_snapshot('preview','article','edited-'||current_setting('cms_test.cache_id'))->'data'->>'post' is not null then raise exception 'Inactive category snapshot leaked';end if;
end $$;
reset role;
update public.categories set is_active=true where id='cache-fixture';
-- Live deletion invalidation is checked through the CMS's recoverable JSON flow.
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.posts'::regclass and tgname='posts_public_revision' and pg_get_triggerdef(oid) like '%DELETE%')then raise exception 'Delete invalidation trigger missing';end if;
end $$;
rollback;
