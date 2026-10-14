alter table public.admin_users add column username text unique
  check (username is null or username ~ '^[a-z0-9_]{3,40}$');
