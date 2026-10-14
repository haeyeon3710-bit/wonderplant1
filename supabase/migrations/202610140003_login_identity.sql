create function public.cms_login_identity(p_username text)
returns table(user_id uuid, email text)
language sql stable security definer set search_path = ''
as $$
  select a.user_id, u.email from public.admin_users a
  join auth.users u on u.id = a.user_id
  where a.username = p_username and a.role = 'admin';
$$;
revoke all on function public.cms_login_identity(text) from public, anon, authenticated;
grant execute on function public.cms_login_identity(text) to service_role;
