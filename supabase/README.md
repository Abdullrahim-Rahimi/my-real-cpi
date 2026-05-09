# Database setup

These migrations create the schema, RLS policies, and seed reference data for My Real CPI.

## Option A — Supabase SQL Editor (fastest)

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in the dashboard.
3. Run each file in order:
   1. `migrations/0001_init.sql` — tables, triggers, RLS policies
   2. `migrations/0002_seed_coicop.sql` — 12 COICOP categories
   3. `migrations/0003_seed_countries.sql` — countries list
4. Copy the project URL and the `anon` and `service_role` keys from **Project Settings → API** into `.env.local` (see `.env.example` in repo root).

## Option B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-ref>
supabase db push
```

## Re-running migrations

All statements use `if not exists` / `on conflict do update`, so it's safe to re-run any file.
