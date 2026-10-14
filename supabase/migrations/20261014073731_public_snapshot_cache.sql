begin;
create table public.cms_public_revisions(
 environment text primary key check(environment in('preview','production')),
 revision bigint not null default 1 check(revision>0)
);
insert into public.cms_public_revisions(environment)values('preview'),('production');
alter table public.cms_public_revisions enable row level security;
revoke all on public.cms_public_revisions from public,anon,authenticated;
grant select on public.cms_public_revisions to anon,authenticated;
grant all on public.cms_public_revisions to service_role;
create policy public_revision_read on public.cms_public_revisions for select to anon,authenticated using(true);

create function cms_private.bump_public_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text;begin
 if tg_table_name='categories' then
  update public.cms_public_revisions set revision=revision+1;
 else
  if tg_op='INSERT' then
   if new.status<>'published' then return null;end if;target:=new.environment;
  elsif tg_op='DELETE' then
   if old.status<>'published' then return null;end if;target:=old.environment;
  else
   if old.status<>'published' and new.status<>'published' then return null;end if;
   if(to_jsonb(new)-'view_count'-'updated_at'-'version') is not distinct from(to_jsonb(old)-'view_count'-'updated_at'-'version') then return null;end if;
   target:=new.environment;
  end if;
  update public.cms_public_revisions set revision=revision+1 where environment=target;
 end if;
 return null;
end $$;
revoke all on function cms_private.bump_public_revision() from public,anon,authenticated,service_role;
create trigger posts_public_revision after insert or update or delete on public.posts for each row execute function cms_private.bump_public_revision();
create trigger categories_public_revision after insert or update or delete on public.categories for each row execute function cms_private.bump_public_revision();

create function public.cms_public_revision(p_environment text) returns text
language sql stable security invoker set search_path='' as $$
 select revision::text from public.cms_public_revisions where environment=p_environment;
$$;
revoke all on function public.cms_public_revision(text) from public;
grant execute on function public.cms_public_revision(text) to anon,authenticated,service_role;

create function public.cms_public_snapshot(p_environment text,p_kind text,p_slug text default null,p_category text default null,p_sort text default 'recent',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;post_data jsonb;redirected boolean:=false;
begin
 if p_environment not in('preview','production') then raise exception 'Invalid environment' using errcode='22023';end if;
 if p_kind='board' then
  result:=jsonb_build_object('overview',public.cms_public_overview(p_environment),'page',public.cms_public_posts(p_environment,p_category,p_sort,p_page));
 elsif p_kind='overview' then result:=public.cms_public_overview(p_environment);
 elsif p_kind='article' then
  select to_jsonb(p) into post_data from(
   select p.id,p.legacy_id,p.title,p.slug,p.summary,p.content,p.legacy_article_html,p.thumbnail,p.thumbnail_alt,p.category_id,p.published_at,p.updated_at,p.view_count
   from public.posts p join public.categories c on c.id=p.category_id and c.is_active
   where p.environment=p_environment and p.status='published' and p.slug=p_slug
  )p;
  if post_data is null then
   select jsonb_build_object('id',p.id,'slug',p.slug) into post_data
   from public.post_slug_aliases a join public.posts p on p.id=a.post_id and p.environment=a.environment
   join public.categories c on c.id=p.category_id and c.is_active
   where a.environment=p_environment and a.slug=p_slug and p.status='published';
   redirected:=post_data is not null;
  end if;
  result:=jsonb_build_object('post',post_data,'redirect',redirected,'overview',case when post_data is not null and not redirected then public.cms_public_overview(p_environment) else null end);
 else raise exception 'Invalid snapshot kind' using errcode='22023';end if;
 return jsonb_build_object('revision',public.cms_public_revision(p_environment),'data',result);
end $$;
revoke all on function public.cms_public_snapshot(text,text,text,text,text,integer) from public;
grant execute on function public.cms_public_snapshot(text,text,text,text,text,integer) to anon,authenticated,service_role;
commit;
