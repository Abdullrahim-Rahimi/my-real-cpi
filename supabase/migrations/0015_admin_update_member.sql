-- Atomic member-edit RPC for the admin UI.
--
-- country_contributors has a composite primary key (user_id, country_code,
-- role), so changing a member's country or role can't be done with a single
-- UPDATE — it would have to be DELETE + INSERT. Wrap that pair in a
-- stored function so the two statements run inside one transaction and
-- can never leave the row in an intermediate state.
--
-- The caller's moderator status is checked inside the function. We pass
-- p_caller_id explicitly because the function is security-definer (auth.uid()
-- inside a function called through PostgREST works, but explicit is clearer
-- and survives any future change in how the action invokes it).

create or replace function public.admin_update_member(
  p_user_id      uuid,
  p_old_country  text,
  p_old_role     public.community_role,
  p_new_country  text,
  p_new_role     public.community_role,
  p_new_status   public.community_status,
  p_caller_id    uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.country_contributors
     where user_id = p_caller_id
       and role = 'moderator'
       and status = 'active'
  ) then
    raise exception 'Moderator access required.';
  end if;

  if p_old_country = p_new_country and p_old_role = p_new_role then
    -- No key change — just touch status + timestamps.
    update public.country_contributors
       set status       = p_new_status,
           approved_by  = p_caller_id,
           approved_at  = case when p_new_status = 'active' and approved_at is null
                                 then now() else approved_at end,
           suspended_at = case when p_new_status = 'suspended' then now()
                                else suspended_at end
     where user_id = p_user_id
       and country_code = p_old_country
       and role = p_old_role;
    if not found then
      raise exception 'Member not found';
    end if;
  else
    -- Atomic swap: delete the old key, insert under the new key.
    delete from public.country_contributors
     where user_id = p_user_id
       and country_code = p_old_country
       and role = p_old_role;
    if not found then
      raise exception 'Member not found';
    end if;
    insert into public.country_contributors
      (user_id, country_code, role, status, approved_at, approved_by, suspended_at)
    values
      (p_user_id,
       p_new_country,
       p_new_role,
       p_new_status,
       case when p_new_status = 'active' then now() else null end,
       p_caller_id,
       case when p_new_status = 'suspended' then now() else null end);
  end if;
end;
$$;

revoke execute on function public.admin_update_member(uuid, text, public.community_role, text, public.community_role, public.community_status, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_member(uuid, text, public.community_role, text, public.community_role, public.community_status, uuid) to service_role;
