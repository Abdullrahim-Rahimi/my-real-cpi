-- Lookup function used by the admin "Add member" flow to find an existing
-- auth.users row by email before deciding whether to invite a new user or
-- attach a role to an existing one.
--
-- The auth schema isn't exposed via PostgREST by default — this RPC is the
-- minimum surface needed and is locked down to the service role only.

create or replace function public.find_user_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function public.find_user_by_email(text) from public;
revoke execute on function public.find_user_by_email(text) from anon, authenticated;
grant execute on function public.find_user_by_email(text) to service_role;
