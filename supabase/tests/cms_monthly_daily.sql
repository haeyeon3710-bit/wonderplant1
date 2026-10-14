begin;
select set_config('cms_monthly.post',gen_random_uuid()::text,true);
select set_config('cms_monthly.production',gen_random_uuid()::text,true);
select set_config('cms_monthly.category',(select id from public.categories where is_active order by sort_order limit 1),true);
select set_config('cms_monthly.admin',(select user_id::text from public.admin_users where role='admin' limit 1),true);
insert into public.posts(id,environment,title,slug,content,category_id,status)
values(current_setting('cms_monthly.post')::uuid,'preview','월별 집계 검증',current_setting('cms_monthly.post'),'[]',current_setting('cms_monthly.category'),'draft'),
(current_setting('cms_monthly.production')::uuid,'production','환경 분리 검증',current_setting('cms_monthly.production'),'[]',current_setting('cms_monthly.category'),'draft');
insert into public.post_view_daily(post_id,environment,view_day,view_count) values
(current_setting('cms_monthly.post')::uuid,'preview','2024-02-01',5),
(current_setting('cms_monthly.post')::uuid,'preview','2024-02-28',7),
(current_setting('cms_monthly.post')::uuid,'preview','2024-02-29',11),
(current_setting('cms_monthly.post')::uuid,'preview','2024-03-01',100),
(current_setting('cms_monthly.post')::uuid,'preview','2025-12-31',3),
(current_setting('cms_monthly.post')::uuid,'preview','2026-01-01',4),
(current_setting('cms_monthly.production')::uuid,'production','2024-02-01',999);
set local role anon;
do $$begin
 begin perform public.cms_admin_daily_views('preview','2024-02-01');raise exception 'Anonymous monthly data exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$begin
 begin perform public.cms_admin_daily_views('preview','2024-02-01');raise exception 'Non-admin monthly data exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('cms_monthly.admin'),true);
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.cms_admin_daily_views('preview','2024-02-01');
 if jsonb_array_length(data->'days')<>29 or (data->>'total')::bigint<>23 or (data->'days'->28->>'views')::bigint<>11 or (data->'days'->1->>'views')::bigint<>0 then raise exception 'Leap month aggregation failed';end if;
 data:=public.cms_admin_daily_views('preview','2025-02-01');
 if jsonb_array_length(data->'days')<>28 or (data->>'total')::bigint<>0 then raise exception 'Empty month failed';end if;
 data:=public.cms_admin_daily_views('preview','2025-12-01');
 if jsonb_array_length(data->'days')<>31 or (data->>'total')::bigint<>3 then raise exception 'Year boundary failed';end if;
 if (public.cms_admin_daily_views('preview','2026-01-01')->>'total')::bigint<>4 then raise exception 'Next year aggregation failed';end if;
 if (public.cms_admin_daily_views('production','2024-02-01')->>'total')::bigint<>999 then raise exception 'Environment separation failed';end if;
 begin perform public.cms_admin_daily_views('preview','2024-02-15');raise exception 'Midmonth accepted';exception when invalid_parameter_value then null;end;
 begin perform public.cms_admin_daily_views('invalid','2024-02-01');raise exception 'Invalid environment accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
rollback;
