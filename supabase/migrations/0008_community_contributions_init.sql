-- Community contribution model: cross-country triad (entry → review → approve).
--
-- Three primary tables:
--   country_contributors     — who has which roles for which country
--   country_source_whitelist — allowed source-URL domains per country
--   cpi_submissions          — append-only log of all submissions, with their
--                              review/approval state
--
-- Cross-country invariants are enforced at three levels:
--   1. CHECK constraints on cpi_submissions (denormalized country fields)
--   2. RLS policies (who can INSERT/UPDATE)
--   3. A BEFORE-INSERT/UPDATE trigger that re-validates the actor invariants
--      against country_contributors so denormalized fields can't be forged.

-- =====================================================================
-- enums
-- =====================================================================
do $$ begin
  create type public.community_role as enum ('contributor', 'reviewer', 'approver', 'moderator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.community_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cpi_submission_status as enum
    ('pending_review', 'pending_approval', 'live', 'rejected', 'superseded');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- country_contributors
-- =====================================================================
create table if not exists public.country_contributors (
  user_id           uuid not null references auth.users(id) on delete cascade,
  country_code      text not null references public.countries(code) on delete cascade,
  role              public.community_role not null,
  status            public.community_status not null default 'pending',
  application_note  text,
  approved_by       uuid references auth.users(id),
  approved_at       timestamptz,
  suspended_at      timestamptz,
  created_at        timestamptz not null default now(),
  primary key (user_id, country_code, role)
);

-- A user can hold role='contributor' for at most ONE country.
create unique index if not exists country_contributors_one_contributor_country
  on public.country_contributors (user_id)
  where role = 'contributor';

create index if not exists country_contributors_country_role_idx
  on public.country_contributors (country_code, role, status);
create index if not exists country_contributors_user_role_idx
  on public.country_contributors (user_id, role, status);

-- =====================================================================
-- country_source_whitelist
-- Domains are matched as host-suffix: 'gss.gov.gh' matches 'data.gss.gov.gh'
-- and 'gss.gov.gh' itself.
-- =====================================================================
create table if not exists public.country_source_whitelist (
  country_code text not null references public.countries(code) on delete cascade,
  domain       text not null check (domain = lower(domain) and length(domain) > 0),
  description  text,
  added_by     uuid references auth.users(id),
  added_at     timestamptz not null default now(),
  primary key (country_code, domain)
);

create index if not exists country_source_whitelist_country_idx
  on public.country_source_whitelist (country_code);

-- =====================================================================
-- cpi_submissions
-- =====================================================================
create table if not exists public.cpi_submissions (
  id              uuid primary key default gen_random_uuid(),

  country_code    text not null references public.countries(code) on delete cascade,
  category_code   text not null references public.coicop_categories(code) on delete cascade,
  period          date not null,
  index_value     numeric(12, 4) not null check (index_value >= 0),
  source_url      text not null check (source_url ~ '^https?://'),

  submitted_by      uuid not null references auth.users(id),
  submitter_country text not null references public.countries(code),
  submitted_at      timestamptz not null default now(),

  reviewer_id       uuid references auth.users(id),
  reviewer_country  text references public.countries(code),
  reviewed_at       timestamptz,
  review_action     text check (review_action in ('approve', 'reject')),
  reviewer_note     text,

  approver_id       uuid references auth.users(id),
  approver_country  text references public.countries(code),
  approved_at       timestamptz,
  approve_action    text check (approve_action in ('approve', 'reject')),
  approver_note     text,

  status            public.cpi_submission_status not null default 'pending_review',
  superseded_by     uuid references public.cpi_submissions(id),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Submitter's denormalized country must match the submission country.
  constraint cpi_sub_submitter_country_eq
    check (submitter_country = country_code),
  -- Three actors must all be distinct.
  constraint cpi_sub_reviewer_not_submitter
    check (reviewer_id is null or reviewer_id != submitted_by),
  constraint cpi_sub_approver_not_submitter
    check (approver_id is null or approver_id != submitted_by),
  constraint cpi_sub_approver_not_reviewer
    check (approver_id is null or reviewer_id is null or approver_id != reviewer_id),
  -- Reviewer and approver must NOT be from the same country (denormalized).
  constraint cpi_sub_reviewer_country_not_submission
    check (reviewer_country is null or reviewer_country != country_code),
  constraint cpi_sub_approver_country_not_submission
    check (approver_country is null or approver_country != country_code)
);

create index if not exists cpi_submissions_pending_review_idx
  on public.cpi_submissions (status, submitted_at)
  where status = 'pending_review';
create index if not exists cpi_submissions_pending_approval_idx
  on public.cpi_submissions (status, reviewed_at)
  where status = 'pending_approval';
create index if not exists cpi_submissions_country_period_idx
  on public.cpi_submissions (country_code, period, status);
create index if not exists cpi_submissions_submitter_idx
  on public.cpi_submissions (submitted_by, submitted_at desc);

drop trigger if exists cpi_submissions_set_updated_at on public.cpi_submissions;
create trigger cpi_submissions_set_updated_at
  before update on public.cpi_submissions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Trigger: actor invariants. The denormalized country fields are not enough
-- on their own — they could be forged by a buggy or malicious app. This
-- trigger cross-references against country_contributors to assert that the
-- claimed roles and countries are actually held.
-- =====================================================================
create or replace function public.assert_cpi_submission_actor_invariants()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_submitter_country text;
  v_clash_country     boolean;
  v_has_role          boolean;
begin
  -- Submitter must have an active contributor role; their country must match.
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

  -- Reviewer (if set) must hold an active reviewer/moderator role and must
  -- NOT be a contributor for the submission's country.
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

  -- Same checks for approver.
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

drop trigger if exists cpi_submissions_assert_actors on public.cpi_submissions;
create trigger cpi_submissions_assert_actors
  before insert or update on public.cpi_submissions
  for each row execute function public.assert_cpi_submission_actor_invariants();

-- =====================================================================
-- Trigger: when a submission goes 'live', sync into cpi_index unless an
-- auto-sourced row already exists (Eurostat/BLS/OECD wins by precedence).
-- =====================================================================
create or replace function public.sync_live_submission_to_cpi_index()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_existing_source text;
begin
  if NEW.status = 'live' and (TG_OP = 'INSERT' or OLD.status <> 'live') then
    select source into v_existing_source
      from public.cpi_index
     where country_code = NEW.country_code
       and category_code = NEW.category_code
       and period = NEW.period;

    if v_existing_source in ('eurostat', 'bls', 'oecd') then
      -- Auto-sourced wins; community row stays in submissions, not promoted.
      return NEW;
    end if;

    insert into public.cpi_index (country_code, category_code, period, index_value, source, fetched_at)
    values (NEW.country_code, NEW.category_code, NEW.period, NEW.index_value, 'community', now())
    on conflict (country_code, category_code, period)
    do update set
      index_value = excluded.index_value,
      source      = 'community',
      fetched_at  = excluded.fetched_at;

    -- YoY for this specific (country, category) cell.
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

drop trigger if exists cpi_submissions_sync_to_index on public.cpi_submissions;
create trigger cpi_submissions_sync_to_index
  after insert or update on public.cpi_submissions
  for each row execute function public.sync_live_submission_to_cpi_index();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.country_contributors      enable row level security;
alter table public.country_source_whitelist  enable row level security;
alter table public.cpi_submissions           enable row level security;

-- Helper: is the current user an active moderator?
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.country_contributors
     where user_id = auth.uid()
       and role = 'moderator'
       and status = 'active'
  );
$$;

-- country_contributors: read-all; users self-apply (status='pending'); mods do everything else.
drop policy if exists "contributors readable by anyone" on public.country_contributors;
create policy "contributors readable by anyone" on public.country_contributors
  for select using (true);

drop policy if exists "users self-apply" on public.country_contributors;
create policy "users self-apply" on public.country_contributors
  for insert with check (
    auth.uid() = user_id and status = 'pending'
  );

drop policy if exists "moderators manage contributors" on public.country_contributors;
create policy "moderators manage contributors" on public.country_contributors
  for all using (public.is_moderator())
  with check (public.is_moderator());

-- whitelist: read-all; mods write.
drop policy if exists "whitelist readable by anyone" on public.country_source_whitelist;
create policy "whitelist readable by anyone" on public.country_source_whitelist
  for select using (true);

drop policy if exists "moderators manage whitelist" on public.country_source_whitelist;
create policy "moderators manage whitelist" on public.country_source_whitelist
  for all using (public.is_moderator())
  with check (public.is_moderator());

-- submissions: read-all; contributors INSERT for their country; reviewers/approvers UPDATE.
-- Trigger blocks cross-country violations beyond what RLS expresses cleanly.
drop policy if exists "submissions readable by anyone" on public.cpi_submissions;
create policy "submissions readable by anyone" on public.cpi_submissions
  for select using (true);

drop policy if exists "contributors submit own country" on public.cpi_submissions;
create policy "contributors submit own country" on public.cpi_submissions
  for insert with check (
    auth.uid() = submitted_by
    and exists (
      select 1 from public.country_contributors c
       where c.user_id = auth.uid()
         and c.country_code = cpi_submissions.country_code
         and c.role = 'contributor'
         and c.status = 'active'
    )
  );

drop policy if exists "reviewers and approvers can update" on public.cpi_submissions;
create policy "reviewers and approvers can update" on public.cpi_submissions
  for update using (
    exists (
      select 1 from public.country_contributors r
       where r.user_id = auth.uid()
         and r.role in ('reviewer', 'approver', 'moderator')
         and r.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.country_contributors r
       where r.user_id = auth.uid()
         and r.role in ('reviewer', 'approver', 'moderator')
         and r.status = 'active'
    )
  );
