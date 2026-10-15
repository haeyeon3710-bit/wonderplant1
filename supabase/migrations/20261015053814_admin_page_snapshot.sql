begin;
create function public.cms_admin_identity() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare profile jsonb;
begin
 select jsonb_build_object('id',a.user_id,'username',a.username) into profile
 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='admin';
 if profile is null then raise exception 'Administrator required' using errcode='42501'; end if;
 return profile;
end $$;
revoke all on function public.cms_admin_identity() from public,anon;
grant execute on function public.cms_admin_identity() to authenticated;
-- One read-only snapshot: current DB role, minimal list / selected full article,
-- categories and statistics. Every underlying query still enforces existing RLS.
create function public.cms_admin_page_snapshot(p_environment text,p_view text,p_post_id text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare profile jsonb; selected_post jsonb; items jsonb:='[]'::jsonb; result jsonb;
begin
 profile:=public.cms_admin_identity();
 if p_environment is null or p_environment not in ('preview','production') or p_view is null or p_view not in ('list','editor') then
  raise exception 'Invalid snapshot parameters' using errcode='22023';
 end if;
 if p_view='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.id),'[]'::jsonb) into items from (
   select p.id,p.legacy_id,p.title,p.slug,p.category_id,p.status,p.scheduled_at,p.created_at,p.published_at,p.updated_at,p.view_count,p.version
   from public.posts p where p.environment=p_environment
  )x;
 elsif p_post_id is not null then
  -- Separate indexed UUID / legacy lookups rather than casting the ID column.
  if p_post_id ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
   select to_jsonb(x) into selected_post from (
    select p.id,p.legacy_id,p.title,p.slug,p.summary,p.content,p.legacy_article_html,p.thumbnail,p.thumbnail_alt,p.category_id,p.status,p.scheduled_at,p.created_at,p.published_at,p.updated_at,p.view_count,p.version
    from public.posts p where p.environment=p_environment and p.id=p_post_id::uuid
   )x;
  elsif p_post_id ~ '^[0-9]{1,10}$' then
   select to_jsonb(x) into selected_post from (
    select p.id,p.legacy_id,p.title,p.slug,p.summary,p.content,p.legacy_article_html,p.thumbnail,p.thumbnail_alt,p.category_id,p.status,p.scheduled_at,p.created_at,p.published_at,p.updated_at,p.view_count,p.version
    from public.posts p where p.environment=p_environment and p.legacy_id=p_post_id
   )x;
  else raise exception 'Invalid post ID' using errcode='22023';
  end if;
  if selected_post is null then raise exception 'Post not found' using errcode='P0002'; end if;
 end if;
 result:=jsonb_build_object('user',profile,'posts',items,'post',selected_post,
  'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.id),'[]'::jsonb) from (
   select id,name,slug,sort_order,is_active from public.categories
  )c));
 if p_view='list' then result:=result||jsonb_build_object('statistics',public.cms_admin_statistics(p_environment)-'daily'); end if;
 return result;
end $$;
revoke all on function public.cms_admin_page_snapshot(text,text,text) from public,anon;
grant execute on function public.cms_admin_page_snapshot(text,text,text) to authenticated;
commit;
