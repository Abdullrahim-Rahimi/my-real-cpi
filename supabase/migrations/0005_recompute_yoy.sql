-- Recompute year-on-year % change for every row in cpi_index by joining
-- each row to the row exactly 12 months earlier for the same (country, category).
-- Idempotent: safe to run after every ingestion.

create or replace function public.recompute_cpi_yoy()
returns void
language sql
security definer
set search_path = public
as $$
  update public.cpi_index ci
  set yoy_pct = round(
        ((ci.index_value / prev.index_value - 1) * 100)::numeric,
        4
      )
  from public.cpi_index prev
  where prev.country_code  = ci.country_code
    and prev.category_code = ci.category_code
    and prev.period        = (ci.period - interval '12 months')::date
    and prev.index_value   > 0;
$$;

-- Allow the service role (cron) to call it.
grant execute on function public.recompute_cpi_yoy() to service_role;
