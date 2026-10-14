begin;
create table public.post_slug_aliases (
 environment text not null check(environment in ('preview','production')),
 slug text not null,
 post_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(environment,slug),
 foreign key(post_id,environment) references public.posts(id,environment) on delete cascade
);
alter table public.post_slug_aliases enable row level security;
revoke all on public.post_slug_aliases from anon,authenticated;
grant select on public.post_slug_aliases to anon,authenticated;
grant all on public.post_slug_aliases to service_role;
create policy aliases_published on public.post_slug_aliases for select to anon,authenticated using (
 exists(select 1 from public.posts p where p.id=post_id and p.environment=post_slug_aliases.environment and p.status='published')
);
create function cms_private.keep_post_slug() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.post_slug_aliases a where a.environment=new.environment and a.slug=new.slug and a.post_id<>new.id) then
  raise exception 'Slug is reserved by an existing post address' using errcode='23505';
 end if;
 if tg_op='UPDATE' and old.slug<>new.slug then
  insert into public.post_slug_aliases(environment,slug,post_id) values(old.environment,old.slug,old.id)
  on conflict(environment,slug) do nothing;
 end if;
 return new;
end $$;
revoke all on function cms_private.keep_post_slug() from public;
create trigger posts_slug_history before insert or update of slug on public.posts for each row execute function cms_private.keep_post_slug();

create function public.cms_public_overview(p_environment text) returns jsonb
language sql stable security invoker set search_path='' as $$
 with visible as (
  select p.id,p.title,p.slug,p.category_id,p.published_at,p.view_count,p.updated_at
  from public.posts p join public.categories c on c.id=p.category_id and c.is_active
  where p.environment=p_environment and p.status='published'
 )
 select jsonb_build_object(
  'total',(select count(*) from visible),
  'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order,x.id),'[]'::jsonb) from (
   select c.id,c.name,c.slug,c.sort_order,(select count(*) from visible v where v.category_id=c.id) as post_count
   from public.categories c where c.is_active
  )x),
  'recent',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select * from visible order by published_at desc,id limit 5)x),
  'popular',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select * from visible order by view_count desc,published_at desc,id limit 5)x)
 );
$$;
revoke all on function public.cms_public_overview(text) from public;
grant execute on function public.cms_public_overview(text) to anon,authenticated,service_role;

create function public.cms_public_posts(p_environment text,p_category text default null,p_sort text default 'recent',p_page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$
 with visible as (
  select p.id,p.title,p.slug,p.summary,p.thumbnail,p.thumbnail_alt,p.category_id,p.published_at,p.view_count,p.updated_at
  from public.posts p join public.categories c on c.id=p.category_id and c.is_active
  where p.environment=p_environment and p.status='published' and (p_category is null or p.category_id=p_category)
 ), page_rows as (
  select * from visible order by case when p_sort='popular' then view_count end desc nulls last,published_at desc,id
  limit 12 offset(greatest(1,least(coalesce(p_page,1),100000))-1)*12
 )
 select jsonb_build_object('posts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from page_rows x),
  'total',(select count(*) from visible),'page',greatest(1,least(coalesce(p_page,1),100000)),
  'pages',ceil((select count(*) from visible)/12.0)::integer);
$$;
revoke all on function public.cms_public_posts(text,text,text,integer) from public;
grant execute on function public.cms_public_posts(text,text,text,integer) to anon,authenticated,service_role;
commit;
