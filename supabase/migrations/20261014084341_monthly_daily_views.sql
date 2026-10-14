begin;
-- Read the existing daily aggregates; no view records or counters are changed.
create function public.cms_admin_daily_views(p_environment text,p_month date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare days jsonb; month_end date;
begin
 if not cms_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_environment is null or p_environment not in ('preview','production') or p_month is null or p_month<>date_trunc('month',p_month)::date then
  raise exception 'Valid environment and first day of month required' using errcode='22023';
 end if;
 month_end:=(p_month+interval '1 month')::date;
 with counts as (
  select view_day,sum(view_count)::bigint as views from public.post_view_daily
  where environment=p_environment and view_day>=p_month and view_day<month_end group by view_day
 ), calendar as (
  select p_month+n as day,coalesce(c.views,0) as views
  from generate_series(0,month_end-p_month-1) as g(n) left join counts c on c.view_day=p_month+n
 ) select jsonb_agg(to_jsonb(calendar) order by day) into days from calendar;
 return jsonb_build_object('month',to_char(p_month,'YYYY-MM'),'days',days,'total',
  (select coalesce(sum((d->>'views')::bigint),0) from jsonb_array_elements(days) d));
end $$;
revoke all on function public.cms_admin_daily_views(text,date) from public,anon;
grant execute on function public.cms_admin_daily_views(text,date) to authenticated;
commit;
