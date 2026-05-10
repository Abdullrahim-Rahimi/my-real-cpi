-- The founding email may not have signed up yet when 0009 ran (auth.users
-- is empty for that address until the first magic-link click). Add an
-- AFTER-INSERT trigger on auth.users so the founder is auto-promoted to
-- moderator on first signup.
--
-- The email is a constant in the trigger to keep it explicit; if you change
-- the founding email, write a new migration that updates this function.

create or replace function public.auto_promote_founder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.email = 'riseadvisorycompany@gmail.com' then
    insert into public.country_contributors (user_id, country_code, role, status, approved_at)
    values (NEW.id, 'US', 'moderator', 'active', now())
    on conflict (user_id, country_code, role) do update
      set status = 'active', approved_at = coalesce(country_contributors.approved_at, now());
  end if;
  return NEW;
end;
$$;

drop trigger if exists auth_users_auto_promote_founder on auth.users;
create trigger auth_users_auto_promote_founder
  after insert on auth.users
  for each row execute function public.auto_promote_founder();
