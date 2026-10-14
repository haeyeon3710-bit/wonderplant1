begin;
do $$
declare
  admin_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  draft_id uuid := gen_random_uuid();
  public_id uuid := gen_random_uuid();
  n integer;
  first_date timestamptz;
begin
  -- Test-only identities, no passwords, committed accounts, or external emails.
  insert into auth.users(id, email) values (admin_id, admin_id::text || '@cms-test.invalid'), (member_id, member_id::text || '@cms-test.invalid');
  insert into public.admin_users(user_id) values(admin_id);
  insert into public.posts(id, environment, title, slug, summary, category_id, status) values
    (draft_id,'preview','RLS draft', 'rls-' || draft_id::text, repeat('가',126), 'implant','draft'),
    (public_id,'preview','RLS published','rls-' || public_id::text, repeat('가',126), 'complex-implant','published');
  if (select published_at from public.posts where id = draft_id) is not null then raise exception 'Draft publication time was set'; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.posts where id in (draft_id,public_id);
  if n <> 1 then raise exception 'Anon can see a draft or cannot read a published post'; end if;
  begin
    insert into public.posts(environment,title,slug,category_id) values ('preview','Denied','denied','implant');
    raise exception 'Anon write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub',member_id,'role','authenticated')::text, true);
  if cms_private.is_admin() then raise exception 'A non-admin has admin access'; end if;
  select count(*) into n from public.posts where id = draft_id;
  if n <> 0 then raise exception 'Non-admin can read drafts'; end if;
  begin
    insert into public.posts(environment,title,slug,category_id) values ('preview','Denied','denied','implant');
    raise exception 'Non-admin write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admin_users(user_id) values(member_id);
    raise exception 'User can promote themselves';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  if not cms_private.is_admin() then raise exception 'Admin check failed'; end if;
  select count(*) into n from public.posts where id = draft_id;
  if n <> 1 then raise exception 'Admin cannot read drafts'; end if;
  update public.posts set status='published',category_id='sedation' where id=draft_id;
  select published_at into first_date from public.posts where id=draft_id;
  if first_date is null then raise exception 'First publication time missing'; end if;
  update public.posts set status='private',title='Edited private post' where id=draft_id;
  if (select published_at from public.posts where id=draft_id) <> first_date then raise exception 'First publication time changed'; end if;
  begin
    update public.posts set view_count=999 where id=public_id;
    raise exception 'Admin can directly change view counts';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.post_views(post_id, environment, visitor_hash) values(public_id,'preview',repeat('a',64));
    raise exception 'Client can insert view records';
  exception when insufficient_privilege then null; end;
  execute 'set local role postgres';
end;
$$;
rollback;
