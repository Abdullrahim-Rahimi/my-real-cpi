-- My Real CPI initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` with the CLI.

-- =============================================================
-- Reference tables (publicly readable)
-- =============================================================

create table if not exists public.countries (
  code         text primary key,                -- ISO 3166-1 alpha-2 (e.g. 'US')
  iso3         text not null,                   -- ISO 3166-1 alpha-3 (e.g. 'USA')
  name         text not null,
  currency     text,                            -- ISO 4217 (e.g. 'USD')
  cpi_source   text,                            -- 'oecd' | 'eurostat' | 'bls' | null
  is_supported boolean not null default false,  -- true once we have category-level CPI
  created_at   timestamptz not null default now()
);

create table if not exists public.coicop_categories (
  code          text primary key,               -- '01' .. '12'
  name          text not null,                  -- official COICOP division name
  short_name    text not null,                  -- friendly UI label
  description   text,
  display_order int  not null
);

create table if not exists public.cpi_index (
  country_code  text not null references public.countries(code) on delete cascade,
  category_code text not null references public.coicop_categories(code) on delete cascade,
  period        date not null,                  -- first day of the month
  index_value   numeric(12, 4) not null,        -- index level, base = 100
  yoy_pct       numeric(8, 4),                  -- year-on-year % change, precomputed
  source        text not null,                  -- 'oecd' | 'eurostat' | 'bls'
  fetched_at    timestamptz not null default now(),
  primary key (country_code, category_code, period)
);

create index if not exists cpi_index_country_period_idx
  on public.cpi_index (country_code, period desc);

-- =============================================================
-- User tables (per-user, RLS enforced)
-- =============================================================

create table if not exists public.user_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  country_code  text references public.countries(code),
  display_name  text,
  currency      text,                           -- defaults from country on save
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.user_spending (
  user_id        uuid not null references auth.users(id) on delete cascade,
  category_code  text not null references public.coicop_categories(code),
  monthly_amount numeric(14, 2) not null check (monthly_amount >= 0),
  updated_at     timestamptz not null default now(),
  primary key (user_id, category_code)
);

-- =============================================================
-- updated_at trigger
-- =============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_spending_set_updated_at on public.user_spending;
create trigger user_spending_set_updated_at
  before update on public.user_spending
  for each row execute function public.set_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================

-- Reference tables: public read, no write from clients (writes happen server-side
-- with the service role key, e.g. from the cron ingestion route).
alter table public.countries          enable row level security;
alter table public.coicop_categories  enable row level security;
alter table public.cpi_index          enable row level security;

drop policy if exists "countries are readable by anyone" on public.countries;
create policy "countries are readable by anyone"
  on public.countries for select using (true);

drop policy if exists "coicop categories are readable by anyone" on public.coicop_categories;
create policy "coicop categories are readable by anyone"
  on public.coicop_categories for select using (true);

drop policy if exists "cpi index is readable by anyone" on public.cpi_index;
create policy "cpi index is readable by anyone"
  on public.cpi_index for select using (true);

-- User tables: each user can only see/edit their own rows.
alter table public.user_profiles enable row level security;
alter table public.user_spending enable row level security;

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile"
  on public.user_profiles for select using (auth.uid() = user_id);

drop policy if exists "users can insert own profile" on public.user_profiles;
create policy "users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "users can update own profile" on public.user_profiles;
create policy "users can update own profile"
  on public.user_profiles for update using (auth.uid() = user_id);

drop policy if exists "users can read own spending" on public.user_spending;
create policy "users can read own spending"
  on public.user_spending for select using (auth.uid() = user_id);

drop policy if exists "users can insert own spending" on public.user_spending;
create policy "users can insert own spending"
  on public.user_spending for insert with check (auth.uid() = user_id);

drop policy if exists "users can update own spending" on public.user_spending;
create policy "users can update own spending"
  on public.user_spending for update using (auth.uid() = user_id);

drop policy if exists "users can delete own spending" on public.user_spending;
create policy "users can delete own spending"
  on public.user_spending for delete using (auth.uid() = user_id);
