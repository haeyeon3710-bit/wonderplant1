begin;
create schema if not exists cms_private;
revoke all on schema cms_private from public;
grant usage on schema cms_private to anon, authenticated, service_role;

create table public.categories (
  id text primary key,
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);
create function cms_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'admin'); $$;
revoke all on function cms_private.is_admin() from public;
grant execute on function cms_private.is_admin() to anon, authenticated, service_role;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  environment text not null check (environment in ('preview', 'production')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  slug text not null check (char_length(slug) <= 80 and slug ~ '^[가-힣a-z0-9]+(-[가-힣a-z0-9]+)*$'),
  summary text not null default '' check (char_length(summary) <= 130),
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  legacy_article_html text,
  original_schema jsonb,
  thumbnail text not null default '',
  thumbnail_alt text not null default '',
  media_paths text[] not null default '{}',
  category_id text not null references public.categories(id),
  status text not null default 'draft' check (status in ('draft', 'published', 'private')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  view_count bigint not null default 0 check (view_count >= 0),
  version integer not null default 1,
  unique (environment, slug),
  unique (environment, legacy_id),
  unique (id, environment),
  check (status <> 'published' or (published_at is not null and char_length(summary) between 120 and 130))
);
create index posts_public_recent on public.posts(environment, published_at desc, id) where status = 'published';
create index posts_category_status on public.posts(environment, category_id, status);
create index posts_public_popular on public.posts(environment, view_count desc, id) where status = 'published';

create function cms_private.prepare_post() returns trigger
language plpgsql set search_path = '' as $$
declare paths text[];
begin
  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'An active category is required' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.environment <> old.environment or new.id <> old.id or new.legacy_id is distinct from old.legacy_id then
      raise exception 'Post identity and environment cannot be changed' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
    new.published_at := old.published_at;
    if (to_jsonb(new) - 'view_count' - 'updated_at' - 'version') is distinct from (to_jsonb(old) - 'view_count' - 'updated_at' - 'version') then
      new.version := old.version + 1; new.updated_at := clock_timestamp();
    else
      new.version := old.version; new.updated_at := old.updated_at;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := clock_timestamp(); end if;
  -- Only verified private Storage paths referenced by this post are public-readable.
  select coalesce(array_agg(distinct substring(src from 8)), '{}') into paths from (
    select new.thumbnail as src
    union all select block->>'src' from jsonb_array_elements(new.content) block where block->>'type' = 'image'
  ) images where src ~ '^/media/(preview|production)/[a-zA-Z0-9/-]+\.(png|jpg|jpeg|webp|gif)$';
  new.media_paths := paths;
  return new;
end; $$;
revoke all on function cms_private.prepare_post() from public;
create trigger posts_prepare before insert or update on public.posts for each row execute function cms_private.prepare_post();

create table public.post_views (
  id bigint generated always as identity primary key,
  post_id uuid not null,
  environment text not null check (environment in ('preview', 'production')),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  viewed_at timestamptz not null default now(),
  foreign key (post_id, environment) references public.posts(id, environment) on delete cascade
);
create index post_views_dedupe on public.post_views(post_id, visitor_hash, viewed_at desc);
create index post_views_period on public.post_views(environment, viewed_at desc, post_id);

alter table public.categories enable row level security;
alter table public.admin_users enable row level security;
alter table public.posts enable row level security;
alter table public.post_views enable row level security;
revoke all on public.categories, public.admin_users, public.posts, public.post_views from anon, authenticated;
grant select on public.categories, public.posts to anon, authenticated;
grant select on public.admin_users, public.post_views to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert (id, environment, title, slug, summary, content, thumbnail, thumbnail_alt, category_id, status, created_by) on public.posts to authenticated;
grant update (title, slug, summary, content, legacy_article_html, thumbnail, thumbnail_alt, category_id, status) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant all on public.categories, public.admin_users, public.posts, public.post_views to service_role;
grant usage, select on sequence public.post_views_id_seq to service_role;

create policy categories_public on public.categories for select to anon, authenticated using (is_active);
create policy categories_admin on public.categories for all to authenticated using ((select cms_private.is_admin())) with check ((select cms_private.is_admin()));
create policy admin_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy posts_public on public.posts for select to anon, authenticated using (
  status = 'published' and exists (select 1 from public.categories c where c.id = posts.category_id and c.is_active)
);
create policy posts_admin on public.posts for all to authenticated using ((select cms_private.is_admin())) with check ((select cms_private.is_admin()));
create policy views_admin on public.post_views for select to authenticated using ((select cms_private.is_admin()));

insert into public.categories(id, name, slug, sort_order) values
 ('implant', '임플란트', 'implant', 1),
 ('complex-implant', '고난도 임플란트', 'complex-implant', 2),
 ('full-implant', '전체 임플란트', 'full-implant', 3),
 ('sedation', '의식하진정법', 'sedation', 4),
 ('orthodontics', '치아교정', 'orthodontics', 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('cms-images', 'cms-images', false, 20971520, array['image/png','image/jpeg','image/webp','image/gif']);
create policy cms_images_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'cms-images' and ((select cms_private.is_admin()) or exists (
   select 1 from public.posts p where p.status = 'published' and p.media_paths @> array[storage.objects.name]
 ))
);
create policy cms_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'cms-images' and (select cms_private.is_admin()));
create policy cms_images_update on storage.objects for update to authenticated using (bucket_id = 'cms-images' and (select cms_private.is_admin())) with check (bucket_id = 'cms-images' and (select cms_private.is_admin()));
create policy cms_images_delete on storage.objects for delete to authenticated using (bucket_id = 'cms-images' and (select cms_private.is_admin()));
commit;
