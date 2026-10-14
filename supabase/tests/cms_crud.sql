begin;
select set_config('cms_test.admin_id',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) values(current_setting('cms_test.admin_id')::uuid,'authenticated','authenticated','cms-crud-fixture@cms-test.invalid');
insert into public.admin_users(user_id,username) values(current_setting('cms_test.admin_id')::uuid,'cms_crud_fixture');
select set_config('request.jwt.claim.sub',current_setting('cms_test.admin_id'),true);
set local role authenticated;
do $$
declare original public.posts; edited public.posts; copied public.posts; affected integer;
begin
 insert into public.posts(environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status,created_by)
 values('preview','CMS 검증','cms-crud-fixture',repeat('가',120),'[{"type":"text","text":"본문"}]','/images/lifespan.png','대표 이미지','implant','draft',auth.uid()) returning * into original;
 if original.published_at is not null then raise exception 'Draft must not have a publication date'; end if;
 update public.posts set title='수정한 초안',category_id='complex-implant' where id=original.id and version=original.version returning * into edited;
 if edited.category_id<>'complex-implant' or edited.version<>original.version+1 then raise exception 'Category/version not saved'; end if;
 update public.posts set title='잘못된 동시 수정' where id=original.id and version=original.version;
 get diagnostics affected=row_count; if affected<>0 then raise exception 'Stale update accepted'; end if;
 update public.posts set status='published' where id=original.id returning * into original;
 if original.published_at is null or original.created_at>original.published_at then raise exception 'Publication time not recorded'; end if;
 insert into public.posts(environment,title,slug,summary,content,legacy_article_html,thumbnail,thumbnail_alt,category_id,status,created_by)
 values('preview','CMS 사본','cms-crud-fixture-copy',original.summary,original.content,'<p>원본 HTML</p>',original.thumbnail,original.thumbnail_alt,original.category_id,'draft',auth.uid()) returning * into copied;
 if copied.id=original.id or copied.published_at is not null then raise exception 'Copy identity/date failed'; end if;
 update public.posts set status='private' where id=original.id returning * into edited;
 if edited.published_at<>original.published_at then raise exception 'First publication date was lost'; end if;
 delete from public.posts where id=copied.id and version=copied.version;
 if exists(select 1 from public.posts where id=copied.id) then raise exception 'Delete failed'; end if;
end $$;
reset role;
rollback;
