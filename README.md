# My Real CPI

A mobile-friendly web app that lets anyone compute their **personal inflation rate** based on their actual spending mix vs the official CPI for their country.

The headline CPI uses an average national basket. Your spending isn't average — so the inflation you experience usually isn't either.

> **Want the deep dive?** See [GUIDE.md](GUIDE.md) for architecture, schema, data sources, the community contribution model, deploy + ops, and troubleshooting.

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind v4
- **Backend**: Supabase (Postgres + email magic-link auth + RLS)
- **Charts**: Recharts
- **Hosting**: Vercel (with Vercel Cron for monthly CPI ingestion)
- **Data**: Eurostat HICP (now), OECD + BLS (next iteration)

## Status

MVP feature-complete for Eurostat-covered countries (EU27 + UK + Switzerland + Norway + Iceland + Türkiye).

- [x] Next.js project + Tailwind + TypeScript
- [x] Supabase clients (browser, server, service-role)
- [x] Auth middleware (session refresh) + magic-link sign-in flow
- [x] Database schema, RLS policies, seeds (12 COICOP categories, ~60 countries)
- [x] Landing page with email signup
- [x] Onboarding (country picker + spending entry, mobile-first)
- [x] Dashboard (personal CPI vs official CPI, per-category breakdown)
- [x] CPI ingestion via Eurostat HICP (monthly Vercel Cron)
- [ ] OECD ingester (stubbed) — covers JP, KR, CA, AU, NZ, MX, CL, IL, etc.
- [ ] US BLS ingester (stubbed) — needs careful COICOP mapping
- [ ] Per-user 12-month inflation chart (deferred)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Sign up / log in at [supabase.com](https://supabase.com) and create a new project (free tier is fine).
2. Open the **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed_coicop.sql`
   - `supabase/migrations/0003_seed_countries.sql`
   - `supabase/migrations/0004_seed_coicop_all_items.sql`
   - `supabase/migrations/0005_recompute_yoy.sql`
3. Open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

### 3. Configure environment variables

```bash
cp .env.example .env.local
# then fill in the values
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Pull initial CPI data

The cron only fires monthly. To populate data immediately for testing:

```bash
curl -H "Authorization: Bearer local-dev-secret" \
     http://localhost:3000/api/cron/ingest
```

(Use whatever `CRON_SECRET` value you set in `.env.local`.)

## Project layout

```
src/
  app/
    page.tsx                       # Landing page + signup
    auth/callback/route.ts         # Magic-link callback
    onboarding/                    # Country + spending entry
    dashboard/                     # Personal CPI vs official, breakdown chart
    api/cron/ingest/route.ts       # Monthly CPI ingestion (Vercel Cron)
    actions/                       # Server actions (auth, onboarding)
  components/
    SignInForm.tsx
  lib/
    supabase/                      # Browser, server, service-role, middleware
    cpi/calculate.ts               # Personal CPI math
    ingestion/                     # Eurostat (full), OECD/BLS (stubs)
    types.ts
  middleware.ts                    # Session refresh on every request
supabase/
  migrations/                      # Schema, RLS, seeds, recompute function
vercel.json                        # Cron schedule
```

## Personal CPI math

```
personal_yoy = Σ (user_weight_i × category_yoy_i)
       where user_weight_i = user_spending_i / total_user_spending
```

Categories where the user has spending but no CPI data are excluded, and the remaining weights are renormalized. The dashboard surfaces a `coverage` percentage so users see how complete their data is.

The headline comparison is the country's all-items YoY (COICOP `00`, e.g. Eurostat `CP00`).

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Set the env vars from `.env.example` in the Vercel project settings.
4. Add `myrealcpi.com` as a custom domain and follow the DNS instructions.
5. The cron job runs automatically on the 5th of each month at 06:00 UTC (configured in `vercel.json`).

## Manually triggering the cron

```bash
# Production
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://myrealcpi.com/api/cron/ingest

# Local
curl -H "Authorization: Bearer local-dev-secret" \
     http://localhost:3000/api/cron/ingest
```

The route is idempotent: it upserts on (country, category, period) and recomputes YoY in SQL, so re-running just refreshes the same rows.
