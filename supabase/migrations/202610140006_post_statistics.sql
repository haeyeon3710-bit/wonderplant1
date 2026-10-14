begin;
create table cms_private.view_bridge (
 environment text primary key check(environment in ('preview','production')),
 secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$')
);
alter table cms_private.view_bridge enable row level security;
revoke all on cms_private.view_bridge from public,anon,authenticated;
grant select on cms_private.view_bridge to service_role;

create table public.post_view_daily (
 post_id uuid not null,
 environment text not null check(environment in ('preview','production')),
 view_day date not null,
 view_count bigint not null default 0 check(view_count>=0),
 primary key(post_id,view_day),
 foreign key(post_id,environment) references public.posts(id,environment) on delete cascade
);
create index post_view_daily_period on public.post_view_daily(environment,view_day,post_id);
alter table public.post_view_daily enable row level security;
revoke all on public.post_view_daily from public,anon,authenticated;
grant select on public.post_view_daily to authenticated;
grant all on public.post_view_daily to service_role;
create policy daily_admin on public.post_view_daily for select to authenticated using((select cms_private.is_admin()));

-- Service-only endpoint. It verifies a narrow bridge credential; clients cannot
-- supply timestamps, counters, or bypass the duplicate window.
create function public.cms_record_post_view(p_environment text,p_post_id uuid,p_visitor_hash text,p_secret text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare total bigint; viewed timestamptz;
begin
 if p_secret is null or length(p_secret)<40 or not exists(
  select 1 from cms_private.view_bridge where environment=p_environment
  and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
 ) then raise exception 'Invalid view bridge credential' using errcode='42501'; end if;
 if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid visitor hash' using errcode='22023'; end if;
 select p.view_count into total from public.posts p
 where p.id=p_post_id and p.environment=p_environment and p.status='published'
 and exists(select 1 from public.categories c where c.id=p.category_id and c.is_active)
 for update;
 if not found then return jsonb_build_object('counted',false,'viewCount',null); end if;
 viewed:=clock_timestamp();
 if exists(select 1 from public.post_views where post_id=p_post_id and visitor_hash=p_visitor_hash and viewed_at>viewed-interval '30 minutes') then
  return jsonb_build_object('counted',false,'viewCount',total);
 end if;
 insert into public.post_views(post_id,environment,visitor_hash,viewed_at) values(p_post_id,p_environment,p_visitor_hash,viewed);
 insert into public.post_view_daily(post_id,environment,view_day,view_count) values(p_post_id,p_environment,(viewed at time zone 'Asia/Seoul')::date,1)
 on conflict(post_id,view_day) do update set view_count=public.post_view_daily.view_count+1;
 update public.posts set view_count=view_count+1 where id=p_post_id returning view_count into total;
 return jsonb_build_object('counted',true,'viewCount',total);
end $$;
revoke all on function public.cms_record_post_view(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cms_record_post_view(text,uuid,text,text) to service_role;

-- Only aggregate counts for currently public posts cross the private boundary.
-- Raw visitor hashes and private post statistics are never returned here.
create function cms_private.public_period_counts(p_environment text,p_days integer) returns table(post_id uuid,period_views bigint)
language sql stable security definer set search_path='' as $$
 select d.post_id,sum(d.view_count)::bigint from public.post_view_daily d
 join public.posts p on p.id=d.post_id and p.environment=d.environment
 join public.categories c on c.id=p.category_id and c.is_active
 where d.environment=p_environment and p.status='published' and p_days in (7,30)
 and d.view_day between (now() at time zone 'Asia/Seoul')::date-(p_days-1) and (now() at time zone 'Asia/Seoul')::date
 group by d.post_id;
$$;
revoke all on function cms_private.public_period_counts(text,integer) from public;
grant execute on function cms_private.public_period_counts(text,integer) to anon,authenticated,service_role;

create function public.cms_public_rankings(p_environment text,p_days integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select p.id,p.title,p.slug,p.published_at,p.category_id,p.view_count,
   case when p_days=0 then p.view_count else coalesce(d.period_views,0) end as period_views
  from public.posts p join public.categories c on c.id=p.category_id and c.is_active
  left join cms_private.public_period_counts(p_environment,p_days) d on d.post_id=p.id
  where p.environment=p_environment and p.status='published' and p_days in (0,7,30)
  order by period_views desc,p.published_at desc,p.id limit 5
 )x;
$$;
revoke all on function public.cms_public_rankings(text,integer) from public;
grant execute on function public.cms_public_rankings(text,integer) to anon,authenticated,service_role;

create or replace function public.cms_public_posts(p_environment text,p_category text default null,p_sort text default 'recent',p_page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$
 with visible as (
  select p.id,p.title,p.slug,p.summary,p.thumbnail,p.thumbnail_alt,p.category_id,p.published_at,p.view_count,p.updated_at,
   coalesce(d.period_views,0) as period_views
  from public.posts p join public.categories c on c.id=p.category_id and c.is_active
  left join cms_private.public_period_counts(p_environment,case p_sort when 'weekly' then 7 when 'monthly' then 30 else 0 end)d on d.post_id=p.id
  where p.environment=p_environment and p.status='published' and (p_category is null or p.category_id=p_category)
 ), page_rows as (
  select * from visible order by case when p_sort='popular' then view_count when p_sort in ('weekly','monthly') then period_views end desc nulls last,published_at desc,id
  limit 12 offset(greatest(1,least(coalesce(p_page,1),100000))-1)*12
 )
 select jsonb_build_object('posts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from page_rows x),
 'total',(select count(*) from visible),'page',greatest(1,least(coalesce(p_page,1),100000)),
 'pages',ceil((select count(*) from visible)/12.0)::integer);
$$;

create or replace function public.cms_public_overview(p_environment text) returns jsonb
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
  'popular',public.cms_public_rankings(p_environment,0),
  'weekly',public.cms_public_rankings(p_environment,7),
  'monthly',public.cms_public_rankings(p_environment,30)
 );
$$;

create function public.cms_admin_statistics(p_environment text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Seoul')::date;
begin
 if not cms_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return jsonb_build_object(
 'totalPosts',(select count(*) from public.posts where environment=p_environment),
 'totalViews',(select coalesce(sum(view_count),0) from public.posts where environment=p_environment),
 'statuses',(select jsonb_object_agg(s.status,s.count) from(select status,count(*) from public.posts where environment=p_environment group by status)s),
 'todayViews',(select coalesce(sum(view_count),0) from public.post_view_daily where environment=p_environment and view_day=today),
 'weekViews',(select coalesce(sum(view_count),0) from public.post_view_daily where environment=p_environment and view_day between today-6 and today),
 'monthViews',(select coalesce(sum(view_count),0) from public.post_view_daily where environment=p_environment and view_day between today-29 and today),
 'daily',(select jsonb_agg(to_jsonb(x) order by x.day) from(select g.day::date as day,coalesce(sum(d.view_count),0) as views from generate_series(today-29,today,interval '1 day')g(day) left join public.post_view_daily d on d.view_day=g.day::date and d.environment=p_environment group by g.day)x),
 'recent',(public.cms_public_overview(p_environment)->'recent'),
 'popular',public.cms_public_rankings(p_environment,0),
 'weekly',public.cms_public_rankings(p_environment,7),
 'monthly',public.cms_public_rankings(p_environment,30));
end $$;
revoke all on function public.cms_admin_statistics(text) from public,anon;
grant execute on function public.cms_admin_statistics(text) to authenticated;
commit;
