begin;
alter table public.posts add column scheduled_at timestamptz;
alter table public.posts drop constraint posts_status_check;
alter table public.posts add constraint posts_status_check check(status in('draft','scheduled','published','private'));
alter table public.posts drop constraint posts_check;
alter table public.posts add constraint posts_published_date_check check(status<>'published' or published_at is not null);
alter table public.posts add constraint posts_schedule_check check((status='scheduled')=(scheduled_at is not null));
grant insert(scheduled_at),update(scheduled_at) on public.posts to authenticated;
create index posts_due_schedule on public.posts(scheduled_at,id) where status='scheduled';

create or replace function cms_private.prepare_post() returns trigger
language plpgsql set search_path='' as $$
declare paths text[];
begin
 if not exists(select 1 from public.categories where id=new.category_id and is_active) then
  raise exception 'An active category is required' using errcode='23514';
 end if;
 if new.status='scheduled' then
  if new.scheduled_at is null then raise exception 'A scheduled publication time is required' using errcode='23514';end if;
  if tg_op='INSERT' then
   if new.scheduled_at<=clock_timestamp() then raise exception 'Schedule must be in the future' using errcode='23514';end if;
  elsif old.status<>'scheduled' or new.scheduled_at is distinct from old.scheduled_at then
   if new.scheduled_at<=clock_timestamp() then raise exception 'Schedule must be in the future' using errcode='23514';end if;
  end if;
  if btrim(new.thumbnail)='' or btrim(new.thumbnail_alt)='' or
   not exists(select 1 from jsonb_array_elements(new.content)b where b->>'type' in('text','heading') and btrim(coalesce(b->>'text',''))<>'') or
   exists(select 1 from jsonb_array_elements(new.content)b where coalesce(b->>'type','') not in('text','heading','image') or
    case when b->>'type'='image' then btrim(coalesce(b->>'src',''))='' or btrim(coalesce(b->>'alt',''))='' else btrim(coalesce(b->>'text',''))='' end) then
   raise exception 'Scheduled post must be ready to publish' using errcode='23514';
  end if;
 else new.scheduled_at:=null;
 end if;
 if tg_op='UPDATE' then
  if new.environment<>old.environment or new.id<>old.id or new.legacy_id is distinct from old.legacy_id then
   raise exception 'Post identity and environment cannot be changed' using errcode='23514';
  end if;
  new.created_at:=old.created_at;new.published_at:=old.published_at;
  if(to_jsonb(new)-'view_count'-'updated_at'-'version') is distinct from(to_jsonb(old)-'view_count'-'updated_at'-'version') then
   new.version:=old.version+1;new.updated_at:=clock_timestamp();
  else new.version:=old.version;new.updated_at:=old.updated_at;
  end if;
 end if;
 if new.status='published' and new.published_at is null then new.published_at:=clock_timestamp();end if;
 select coalesce(array_agg(distinct substring(src from 8)),'{}') into paths from(
  select new.thumbnail as src union all select block->>'src' from jsonb_array_elements(new.content)block where block->>'type'='image'
 )images where src~'^/media/(preview|production)/[a-zA-Z0-9/-]+\.(png|jpg|jpeg|webp|gif)$';
 new.media_paths:=paths;return new;
end $$;

-- Runs only as the database owner. There is no public scheduler endpoint/key.
create function cms_private.publish_due_posts() returns integer
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 with due as(
  select p.id from public.posts p join public.categories c on c.id=p.category_id and c.is_active
  where p.status='scheduled' and p.scheduled_at<=clock_timestamp()
  order by p.scheduled_at,p.id limit 100 for update of p skip locked
 )
 update public.posts p set status='published' from due where p.id=due.id;
 get diagnostics changed=row_count;return changed;
end $$;
revoke all on function cms_private.publish_due_posts() from public,anon,authenticated,service_role;
grant execute on function cms_private.publish_due_posts() to postgres;
create extension if not exists pg_cron;
select cron.schedule('cms-publish-scheduled','* * * * *','select cms_private.publish_due_posts()');
select cron.schedule('cms-publish-history-cleanup','0 0 * * *',
 $$delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname in('cms-publish-scheduled','cms-publish-history-cleanup')) and end_time<now()-interval '7 days'$$);
commit;
