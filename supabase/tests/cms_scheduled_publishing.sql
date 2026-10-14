begin;
select set_config('cms_test.admin_id',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email)values(current_setting('cms_test.admin_id')::uuid,'authenticated','authenticated','cms-schedule-fixture@cms-test.invalid');
insert into public.admin_users(user_id,username)values(current_setting('cms_test.admin_id')::uuid,'cms_schedule_fixture');
select set_config('request.jwt.claim.sub',current_setting('cms_test.admin_id'),true);
insert into public.categories(id,name,slug,sort_order)values('schedule-fixture','예약 테스트','schedule-fixture',999);
set local role authenticated;
do $$declare p public.posts;begin
 insert into public.posts(environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status,scheduled_at,created_by)
 values('preview','예약 테스트','schedule-fixture-due','','[{"type":"text","text":"본문"}]','/images/lifespan.png','대체 설명','implant','scheduled',clock_timestamp()+interval '1 second',auth.uid())returning * into p;
 perform set_config('cms_test.schedule_id',p.id::text,true);
 if p.published_at is not null then raise exception 'Scheduling is not publishing';end if;
 insert into public.posts(environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status,scheduled_at)
 values('preview','미래 예약','schedule-fixture-future','짧은 설명','[{"type":"text","text":"본문"}]','/images/lifespan.png','대체 설명','implant','scheduled',clock_timestamp()+interval '1 hour');
 insert into public.posts(environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status,scheduled_at)
 values('preview','취소 예약','schedule-fixture-cancel','','[{"type":"text","text":"본문"}]','/images/lifespan.png','대체 설명','implant','scheduled',clock_timestamp()+interval '1 hour');
 update public.posts set status='draft' where slug='schedule-fixture-cancel';
 if exists(select 1 from public.posts where slug='schedule-fixture-cancel' and scheduled_at is not null)then raise exception 'Cancelled schedule retained';end if;
 insert into public.posts(environment,title,slug,summary,content,thumbnail,thumbnail_alt,category_id,status,scheduled_at)
 values('preview','비활성 분류 예약','schedule-fixture-inactive','','[{"type":"text","text":"본문"}]','/images/lifespan.png','대체 설명','schedule-fixture','scheduled',clock_timestamp()+interval '1 second');
 update public.categories set is_active=false where id='schedule-fixture';
 begin
  update public.posts set scheduled_at=clock_timestamp()-interval '1 hour' where slug='schedule-fixture-future';
  raise exception 'Past schedule accepted';
 exception when check_violation then null;end;
 begin
  update public.posts set summary=repeat('가',131) where slug='schedule-fixture-future';
  raise exception 'Overlong summary accepted';
 exception when check_violation then null;end;
 begin
  perform cms_private.publish_due_posts();raise exception 'Client can run the scheduler';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 if exists(select 1 from public.posts where slug like 'schedule-fixture-%')then raise exception 'Scheduled posts leaked publicly';end if;
 if exists(select 1 from jsonb_array_elements(public.cms_public_overview('preview')->'recent')p where p->>'slug' like 'schedule-fixture-%')then raise exception 'Scheduled recent leaked';end if;
 begin perform cms_private.publish_due_posts();raise exception 'Anonymous scheduler allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_sleep(1.5);
do $$declare first_publication timestamptz;begin
 if cms_private.publish_due_posts()<>1 then raise exception 'Due scheduling or inactive category gating failed';end if;
 if cms_private.publish_due_posts()<>0 then raise exception 'Scheduler is not idempotent';end if;
 select published_at into first_publication from public.posts where id=current_setting('cms_test.schedule_id')::uuid and status='published' and scheduled_at is null;
 if first_publication is null then raise exception 'First publication missing';end if;
 update public.posts set title='수정 후 제목',status='private' where id=current_setting('cms_test.schedule_id')::uuid;
 update public.posts set status='published' where id=current_setting('cms_test.schedule_id')::uuid;
 if(select published_at from public.posts where id=current_setting('cms_test.schedule_id')::uuid)<>first_publication then raise exception 'First publication time changed';end if;
 update public.categories set is_active=true where id='schedule-fixture';
 if cms_private.publish_due_posts()<>1 then raise exception 'Reactivated category did not publish';end if;
 if not exists(select 1 from public.posts where slug='schedule-fixture-future' and status='scheduled')then raise exception 'Future post published early';end if;
 if not exists(select 1 from public.posts where slug='schedule-fixture-cancel' and status='draft')then raise exception 'Cancelled post published';end if;
end $$;
set local role anon;
do $$begin
 if not exists(select 1 from public.posts where id=current_setting('cms_test.schedule_id')::uuid and summary='')then raise exception 'Empty summary publication failed';end if;
end $$;
reset role;
rollback;
