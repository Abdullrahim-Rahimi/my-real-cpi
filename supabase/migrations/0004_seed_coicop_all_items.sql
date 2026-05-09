-- Add the headline "all items" entry. We ingest it alongside the 12 divisions
-- so the dashboard can show personal CPI vs official CPI from a single table.
-- display_order = 0 lets us filter it out of the per-category breakdown.

insert into public.coicop_categories (code, name, short_name, description, display_order) values
  ('00', 'All items',           'All items / headline',     'Country headline CPI (sum of all categories at official weights)', 0)
on conflict (code) do update set
  name          = excluded.name,
  short_name    = excluded.short_name,
  description   = excluded.description,
  display_order = excluded.display_order;
