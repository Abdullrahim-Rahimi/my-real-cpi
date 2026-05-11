-- Same-period submission semantics.
--
-- Three changes:
--   1. Partial unique index so a contributor can have at most ONE non-final
--      submission per (country, category, period). Stops them from double-
--      submitting while a previous batch is still in review/approval.
--   2. Update sync_live_submission_to_cpi_index to also mark any other 'live'
--      submissions for the same cell as 'superseded' when a new one lands.
--      Keeps the audit log consistent — exactly one row is 'live' per cell.
--   3. Relax assert_cpi_submission_actor_invariants to skip the submitter
--      check on UPDATE. That fixes two cases:
--        a. A reviewer reviewing a batch whose submitter has since
--           suspended their contributor role (rare but possible).
--        b. A submitter withdrawing their own pending submission (added
--           below): the withdrawal is an UPDATE, and a stepped-down
--           submitter would otherwise trip the active-role check.

-- ---- 1. Unique constraint -------------------------------------------------
create unique index if not exists cpi_submissions_one_in_flight_per_cell
  on public.cpi_submissions (submitted_by, country_code, category_code, period)
  where status in ('pending_review', 'pending_approval');

-- ---- 2. Supersede + 3. relaxed trigger ------------------------------------
create or replace function public.assert_cpi_submission_actor_invariants()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_submitter_country text;
  v_clash_country     boolean;
  v_has_role          boolean;
begin
  -- Submitter check ONLY on INSERT. Submitter_by / submitter_country /
  -- country_code are immutable in practice post-insert (no path mutates
  -- them) so re-checking on UPDATE just creates false negatives when the
  -- submitter has stepped down between submitting and being reviewed.
  if TG_OP = 'INSERT' then
    select country_code into v_submitter_country
      from public.country_contributors
     where user_id = NEW.submitted_by
       and role = 'contributor'
       and status = 'active'
     limit 1;
    if v_submitter_country is null then
      raise exception 'submitted_by % has no active contributor role', NEW.submitted_by;
    end if;
    if v_submitter_country <> NEW.country_code then
      raise exception 'submitter is contributor for % but submission is for %', v_submitter_country, NEW.country_code;
    end if;
    if NEW.submitter_country <> v_submitter_country then
      raise exception 'submitter_country (%) does not match contributor country (%)', NEW.submitter_country, v_submitter_country;
    end if;
  end if;

  -- Reviewer/approver checks fire on both INSERT and UPDATE — they're set
  -- during the review/approve transitions.
  if NEW.reviewer_id is not null then
    select exists(
      select 1 from public.country_contributors
       where user_id = NEW.reviewer_id
         and country_code = NEW.country_code
         and role = 'contributor'
         and status = 'active'
    ) into v_clash_country;
    if v_clash_country then
      raise exception 'reviewer % is a contributor of % — cross-country rule violated', NEW.reviewer_id, NEW.country_code;
    end if;

    select exists(
      select 1 from public.country_contributors
       where user_id = NEW.reviewer_id
         and role in ('reviewer', 'moderator')
         and status = 'active'
    ) into v_has_role;
    if not v_has_role then
      raise exception 'reviewer_id % lacks active reviewer role', NEW.reviewer_id;
    end if;
  end if;

  if NEW.approver_id is not null then
    select exists(
      select 1 from public.country_contributors
       where user_id = NEW.approver_id
         and country_code = NEW.country_code
         and role = 'contributor'
         and status = 'active'
    ) into v_clash_country;
    if v_clash_country then
      raise exception 'approver % is a contributor of % — cross-country rule violated', NEW.approver_id, NEW.country_code;
    end if;

    select exists(
      select 1 from public.country_contributors
       where user_id = NEW.approver_id
         and role in ('approver', 'moderator')
         and status = 'active'
    ) into v_has_role;
    if not v_has_role then
      raise exception 'approver_id % lacks active approver role', NEW.approver_id;
    end if;
  end if;

  return NEW;
end;
$$;

-- Recreate the live-sync trigger with supersession of previously-live rows.
create or replace function public.sync_live_submission_to_cpi_index()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_existing_source text;
begin
  if NEW.status = 'live' and (TG_OP = 'INSERT' or OLD.status <> 'live') then
    -- Mark any OTHER live submissions for the same cell as superseded.
    -- This is the audit-log half of the consistency story; cpi_index gets
    -- the UPSERT below. No recursion risk: the recursive UPDATE sets
    -- status='superseded', which doesn't match the outer condition.
    update public.cpi_submissions
       set status = 'superseded',
           superseded_by = NEW.id
     where country_code = NEW.country_code
       and category_code = NEW.category_code
       and period = NEW.period
       and status = 'live'
       and id <> NEW.id;

    select source into v_existing_source
      from public.cpi_index
     where country_code = NEW.country_code
       and category_code = NEW.category_code
       and period = NEW.period;

    if v_existing_source in ('eurostat', 'bls', 'oecd') then
      return NEW;
    end if;

    insert into public.cpi_index (country_code, category_code, period, index_value, source, fetched_at)
    values (NEW.country_code, NEW.category_code, NEW.period, NEW.index_value, 'community', now())
    on conflict (country_code, category_code, period)
    do update set
      index_value = excluded.index_value,
      source      = 'community',
      fetched_at  = excluded.fetched_at;

    update public.cpi_index ci
       set yoy_pct = round(((ci.index_value / prev.index_value - 1) * 100)::numeric, 4)
      from public.cpi_index prev
     where ci.country_code = NEW.country_code
       and ci.category_code = NEW.category_code
       and prev.country_code = ci.country_code
       and prev.category_code = ci.category_code
       and prev.period = (ci.period - interval '12 months')::date
       and prev.index_value > 0;
  end if;

  return NEW;
end;
$$;

-- ---- RLS: submitter can withdraw their own pending submission -------------
drop policy if exists "users withdraw own pending submissions" on public.cpi_submissions;
create policy "users withdraw own pending submissions" on public.cpi_submissions
  for update
  using (
    submitted_by = auth.uid()
    and status in ('pending_review', 'pending_approval')
  )
  with check (
    submitted_by = auth.uid()
    and status = 'rejected'
  );
