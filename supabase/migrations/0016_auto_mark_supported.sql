-- Keep countries.is_supported in sync with cpi_index reality.
--
-- Background:
--   countries.is_supported was set at seed time based on "do we have an
--   auto-ingester for this country" (Eurostat / BLS). For community-
--   contributed data the flag never updated — so once a community batch
--   went live for, say, Kuwait, KW had cpi_index rows but the onboarding
--   "coming soon for this country" warning was still showing on the
--   dropdown. Wrong, and confusing for users picking the country.
--
-- New rule:
--   is_supported = "any CPI data exists for this country, from any source"
--   cpi_source   = "if non-null, the cron auto-ingests this country"
-- The two are orthogonal. The cron still filters by cpi_source (so this
-- change does not make the cron suddenly try to fetch community countries),
-- but the UI now reflects reality.

-- 1. Trigger that flips the flag on every new cpi_index row.
create or replace function public.mark_country_supported_on_data()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.countries
    set is_supported = true
   where code = NEW.country_code
     and is_supported = false;
  return NEW;
end;
$$;

drop trigger if exists cpi_index_mark_supported on public.cpi_index;
create trigger cpi_index_mark_supported
  after insert on public.cpi_index
  for each row execute function public.mark_country_supported_on_data();

-- 2. Backfill: any country that already has cpi_index rows but
-- is_supported=false gets flipped now.
update public.countries
   set is_supported = true
 where is_supported = false
   and code in (select distinct country_code from public.cpi_index);
