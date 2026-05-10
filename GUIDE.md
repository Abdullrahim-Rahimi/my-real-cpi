# My Real CPI — operator's guide

A practical guide to understanding, running, and operating this project end-to-end. The [README](README.md) is the quickstart; this document is the deep-dive.

---

## Table of contents

1. [What this project is](#what-this-project-is)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Tech stack and why](#tech-stack-and-why)
4. [Database schema](#database-schema)
5. [Personal CPI math](#personal-cpi-math)
6. [Data sources](#data-sources)
7. [Community contribution model](#community-contribution-model)
8. [Local development](#local-development)
9. [Operating the system](#operating-the-system)
10. [Deployment](#deployment)
11. [Testing](#testing)
12. [Where to look — file map](#where-to-look--file-map)
13. [Troubleshooting](#troubleshooting)
14. [Roadmap and explicitly deferred work](#roadmap-and-explicitly-deferred-work)

---

## What this project is

A mobile-friendly web app at **[myrealcpi.com](https://myrealcpi.com)** that computes a user's *personal* inflation rate from their actual spending mix vs the official headline CPI for their country.

The headline CPI uses an average national basket. Your spending isn't average — so the inflation you experience usually isn't either. The app:

1. Lets users sign up via email magic link.
2. Asks them to pick their country and enter rough monthly spend across 13 [COICOP](https://unstats.un.org/unsd/classifications/Family/Detail/1100) categories.
3. Computes their personal CPI as a weighted average of category-level YoY changes from official monthly data.
4. Compares it side-by-side with the country's headline CPI.

The hard part isn't the math; it's keeping per-country, per-category CPI fresh from trusted sources. We solve that with three layers: automated ingestion (Eurostat + BLS), a community contribution pipeline for everywhere else, and the explicit policy that we never silently approximate missing data.

---

## Architecture at a glance

```
                ┌───────────────────────────────────────┐
                │  myrealcpi.com (Vercel edge + CDN)    │
                │  ┌─────────────────────────────────┐  │
                │  │  Next.js 15 (App Router)        │  │
                │  │  Server components + client UI  │  │
                │  └────────────────┬────────────────┘  │
                └───────────────────┼───────────────────┘
                                    │  cookie-session HTTP
                                    ▼
                ┌──────────────────────────────────────┐
                │  Supabase                            │
                │  ┌────────────────────────────────┐  │
                │  │  Auth (email magic-link)       │  │
                │  ├────────────────────────────────┤  │
                │  │  Postgres + RLS                │  │
                │  │   - countries (205)            │  │
                │  │   - coicop_categories (13)     │  │
                │  │   - cpi_index                  │  │
                │  │   - user_profiles, _spending   │  │
                │  │   - country_contributors       │  │
                │  │   - country_source_whitelist   │  │
                │  │   - cpi_submissions            │  │
                │  └────────────────────────────────┘  │
                └──────────────▲───────────────────────┘
                               │ service-role only
                               │
                ┌──────────────┴────────────────────┐
                │  /api/cron/ingest                 │
                │   fired monthly by Vercel Cron    │
                │   - Eurostat HICP (~32 countries) │
                │   - US BLS CPI-U                  │
                │   - upserts cpi_index             │
                │   - recomputes YoY in SQL         │
                └───────────────────────────────────┘
```

The same database also backs a **community contribution pipeline** (see [Community contribution model](#community-contribution-model)) for countries the cron can't auto-ingest.

---

## Tech stack and why

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | SSR + React Server Components for fast first paint, server actions for auth-aware mutations, file-system routing |
| Styling | Tailwind v4 | Mobile-first by default, no CSS files to maintain |
| Charts | Recharts | Tiny, declarative, mobile-friendly |
| DB + Auth | Supabase (Postgres + magic-link + RLS) | Generous free tier, Postgres-native (RLS does the security heavy lifting), auth out of the box |
| Hosting | Vercel | Native Next.js, free hobby tier, built-in Cron |
| Validation | Zod | Server-action input parsing |
| Tests | Vitest | Fast, ESM-native, TS out of the box |

---

## Database schema

### Reference tables (publicly readable)

- **`countries`** — all 205 ISO 3166-1 countries, plus `region`, `cpi_source` (`'eurostat' | 'bls' | 'oecd' | null`), `is_supported`.
- **`coicop_categories`** — 13 rows: `00` (all-items headline) + `01..12` (divisions).

### Time-series

- **`cpi_index(country_code, category_code, period)`** — monthly index value + precomputed YoY%, with `source ∈ {eurostat, bls, oecd, community}`. Auto-sourced rows always win precedence over community ones for the same cell.

### User data (RLS-protected)

- **`user_profiles(user_id)`** — country, currency, display name, onboarded timestamp.
- **`user_spending(user_id, category_code)`** — per-category monthly spend.

### Community contributions

- **`country_contributors(user_id, country_code, role)`** — `role ∈ {contributor, reviewer, approver, moderator}`, plus `status ∈ {pending, active, suspended}`.
  - A user can hold `role='contributor'` for **at most one country** (enforced by partial unique index).
  - `reviewer`/`approver` rows aren't bound to a specific submission country; the cross-country rule is enforced per submission.
- **`country_source_whitelist(country_code, domain)`** — allowed source-URL domains per country, suffix-matched.
- **`cpi_submissions`** — append-only log of every submission with full audit trail (submitter, reviewer, approver, denormalized country fields, timestamps, notes, status).

### Helper functions / triggers

| Name | Purpose |
|---|---|
| `recompute_cpi_yoy()` | Recomputes YoY% across all rows. Called after every ingestion. |
| `is_moderator()` | RLS helper — true iff the current user has an active `moderator` role. |
| `assert_cpi_submission_actor_invariants()` | BEFORE-trigger on `cpi_submissions`. Cross-validates submitter/reviewer/approver against `country_contributors` so denormalized fields can't be forged. |
| `sync_live_submission_to_cpi_index()` | AFTER-trigger that promotes `live` submissions into `cpi_index` (only when no auto-sourced row exists for that cell). |
| `auto_promote_founder()` | AFTER-trigger on `auth.users` that auto-grants `moderator` role to the founding email on first signup. |
| `set_updated_at()` | Generic `updated_at` setter on rows that need it. |

---

## Personal CPI math

```
personal_yoy_pct = Σ (user_weight_i × yoy_pct_i)
                  i ∈ categories with both spending and a YoY value

where user_weight_i = user_spending_i / Σ user_spending_j   (over covered j)
```

Categories with spending but no CPI data are excluded from the sum, and the remaining weights are **renormalized over the covered subset**. The dashboard surfaces a `coverage_pct` so users see how complete their data is. The headline comparison is the country's all-items YoY (COICOP `00`).

Implementation: [`src/lib/cpi/calculate.ts`](src/lib/cpi/calculate.ts).

---

## Data sources

### Eurostat HICP (32 countries, monthly)

- Endpoint: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/prc_hicp_midx/{key}/`
- Format: JSON-stat 2.0 via `Accept: application/json` + `?lang=EN`
- Dimension key: `freq.unit.coicop.geo`, dot-separated, `+`-joined within a dimension
- Coverage: EU27 + UK + CH + NO + IS + TR
- Notable: Eurostat uses non-ISO codes — `UK` for Great Britain, `EL` for Greece. Mapped in code.
- Implementation: [`src/lib/ingestion/eurostat.ts`](src/lib/ingestion/eurostat.ts)

### US BLS (1 country, monthly)

- Endpoint: `https://api.bls.gov/publicAPI/v2/timeseries/data/` (POST JSON)
- Auth: optional `BLS_API_KEY` (raises rate limit from 25 → 500/day)
- Coverage: US only
- COICOP mapping has known approximations — BLS major groups don't cleanly split the way COICOP does. Notable gaps:
  - **02 (Alcohol & tobacco)**: only alcohol (`SEFW`); tobacco lives inside `SAG`.
  - **04 (Housing & utilities)**: `SAH` rolls up household furnishings (`SAH3`), which is mapped separately to **05**, so 05's contribution gets slightly overweighted.
  - **11 (Restaurants & hotels)**: "Food away from home" only (`SEFV`); no clean accommodation index.
- Implementation: [`src/lib/ingestion/bls.ts`](src/lib/ingestion/bls.ts)

### OECD — intentionally stubbed (do not retry)

OECD's prices SDMX 3.0 API has two relevant dataflows; both are dead ends:

- `DSD_PRICES@DF_PRICES_ALL` (COICOP 1999) — full CP01..CP12 breakdown, but **frozen at 2021-06**.
- `DSD_PRICES_COICOP2018@DF_PRICES_C2018_ALL` (COICOP 2018) — current, but only 2 of 12 categories exposed for non-EU members.

The full investigation is documented in [`src/lib/ingestion/oecd.ts`](src/lib/ingestion/oecd.ts). For non-EU/non-US countries, the path forward is **per-country national stat office integrations** (Statistics Canada is the cleanest first target).

### Community contributions

For everywhere we can't auto-ingest. Three-stage cross-country pipeline; see next section.

---

## Community contribution model

The threat model is collusion. Open writes (Wikipedia-style) are unsafe for inflation data because users make decisions on it. A trusted-lead-only model is also fragile (one person can be coerced or go rogue). The triad mitigates both:

```
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│  Submit                  │    │  Review                  │    │  Approve                 │
│  contributor in X        │ ─▶ │  reviewer NOT in X       │ ─▶ │  approver NOT in X       │
│  attaches source URL     │    │  must ≠ submitter        │    │  must ≠ submitter        │
│  (whitelist-checked)     │    │  verifies vs source URL  │    │  must ≠ reviewer         │
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
       writes pending_review        ─▶ pending_approval               ─▶ live (in cpi_index)
```

### Three-layer defense in depth (don't weaken any)

1. **CHECK constraints** on denormalized country fields in `cpi_submissions`.
2. **RLS policies** enforcing role-based access for INSERT/UPDATE.
3. **A BEFORE-trigger** that re-validates against `country_contributors` so the denormalized fields can't be forged by a buggy or malicious app.

### Source-URL whitelist matching

Suffix match: `host == domain OR host.endsWith('.' + domain)`. The leading-dot check is critical — without it, `evilgss.gov.gh` would match the `gss.gov.gh` rule. The unit test in [`src/lib/community/whitelist.test.ts`](src/lib/community/whitelist.test.ts) covers this exact spoofing case.

### Sybil resistance

| Mechanism | Configuration | File |
|---|---|---|
| Account-age gate (≥30 days) | `MIN_ACCOUNT_AGE_DAYS` constant | `src/lib/community/roles.ts` |
| Submission rate limit (1 batch / user / country / period / day) | hardcoded | `src/app/actions/community.ts` (`submitCpiBatch`) |
| hCaptcha (prepared, off by default) | Set `HCAPTCHA_SECRET` env var to activate | `src/lib/community/captcha.ts` |

### Precedence: auto-sourced data always wins

When a community submission is approved, the trigger checks `cpi_index` first. If a row already exists with `source ∈ {eurostat, bls, oecd}`, the community submission stays in `cpi_submissions` but is **not** promoted into `cpi_index`. Auto-sourced data wins by precedence, which means community submissions are a fallback, never an override.

---

## Local development

### Prerequisites

- Node.js ≥ 20
- A Supabase project (free tier is fine)
- A Vercel account (only needed to deploy)

### Setup

```bash
# 1. Install deps
npm install

# 2. Apply migrations to your Supabase project
#    (or paste each supabase/migrations/*.sql file into Supabase SQL Editor)
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push

# 3. Create .env.local
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL=http://localhost:3000,
# CRON_SECRET=<long random string>

# 4. Run the dev server
npm run dev

# 5. Populate CPI data (the cron only fires monthly, so trigger it manually)
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/ingest
```

Then open http://localhost:3000.

### Run tests

```bash
npm test            # one-shot
npm run test:watch  # interactive
```

### Type-check

```bash
npx tsc --noEmit
```

### Production build (locally)

```bash
npx next build
```

---

## Operating the system

### Initial moderator bootstrap

The founding email (currently `riseadvisorycompany@gmail.com`, hardcoded in migration `0010_auto_promote_founder.sql`) is **auto-promoted to moderator** on first magic-link signup, via an `auth.users` AFTER-INSERT trigger.

To change the founding email, write a new migration that updates `auto_promote_founder()`. Don't edit migration 0010 in place.

### As moderator — approving applications

1. Sign in.
2. Navigate to `/admin/applications`.
3. For each pending row, click **Approve** or **Reject**.
4. Approved rows update `country_contributors.status = 'active'`. Rejected rows are deleted (the user can re-apply).

### As moderator — managing the source-URL whitelist

1. `/admin/whitelist`.
2. Add domain entries per country. Use the official statistics office's root domain (`gss.gov.gh`, not `https://gss.gov.gh/cpi-page-1`).
3. Suffix matching means `data.gss.gov.gh` and `gss.gov.gh` itself both pass with one rule.
4. Remove entries the same way.

### Manually triggering the monthly cron

```bash
# Production
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://myrealcpi.com/api/cron/ingest

# Local
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/ingest
```

The route is **idempotent**: it upserts on `(country, category, period)` and recomputes YoY in SQL. Re-running just refreshes the same rows. Returns JSON with row counts per source.

### Adding a new auto-ingested country

1. **Identify the source** — national stats office API, OECD if its breakdown is sufficient, etc.
2. **Add a fetcher** at `src/lib/ingestion/{source}.ts` returning `IngestRow[]` (see Eurostat as the reference implementation).
3. **Wire it into the cron route** at `src/app/api/cron/ingest/route.ts` (it already runs each fetcher in parallel and collects per-source results).
4. **Update the country row**: set `cpi_source = '<source>'` and `is_supported = true` via a new migration.
5. Manually trigger the cron once after deploy to backfill data.

### Adding a country to the community contribution pipeline

1. As moderator at `/admin/whitelist`, add the official statistics office domain(s) for that country.
2. Wait for someone in-country to apply via `/contribute`.
3. Approve their application at `/admin/applications`.
4. They'll submit; reviewers/approvers from other countries process the queue.
5. Once a batch goes `live`, the trigger writes it into `cpi_index` and the dashboard reflects it for users of that country.

### Inspecting data — quick SQL queries

Via Supabase Dashboard → SQL Editor (or via the Management API with a PAT):

```sql
-- Latest CPI cell for a country
select category_code, period, index_value, yoy_pct, source
  from cpi_index
 where country_code = 'US'
 order by period desc, category_code
 limit 26;

-- Pending applications
select user_id, country_code, role, application_note, created_at
  from country_contributors
 where status = 'pending'
 order by created_at;

-- Audit trail of a community submission
select status, submitted_by, submitter_country,
       reviewer_id, reviewer_country, review_action, reviewer_note,
       approver_id, approver_country, approve_action, approver_note
  from cpi_submissions
 where country_code = 'GH' and period = '2026-04-01'
 order by category_code;
```

### Rotating credentials

If any token leaks:

| Credential | Where to rotate |
|---|---|
| Supabase Personal Access Token | https://supabase.com/dashboard/account/tokens |
| Supabase service-role key | Project Settings → API → Reset (then update Vercel env var) |
| Supabase DB password | Project Settings → Database → Reset password |
| Vercel access token | https://vercel.com/account/tokens |
| `CRON_SECRET` | Generate new with `openssl rand -hex 32`, update Vercel env var, redeploy |

---

## Deployment

### One-time setup (already done)

- GitHub repo: `Abdullrahim-Rahimi/my-real-cpi`
- Vercel project: `abdullrahim-rahimis-projects/my-real-cpi`
- Custom domain: `myrealcpi.com` (apex + `www` 308-redirect)
- DNS: AWS Route 53 (apex A → Vercel anycast IPs, `www` CNAME → Vercel)
- Supabase auth allowlist includes the production URL + `*.vercel.app` preview wildcards

### Day-to-day deploys

The CLI deploys current `master`:

```bash
npx vercel --prod --yes --scope abdullrahim-rahimis-projects
```

To enable **auto-deploy on git push**: connect GitHub at https://vercel.com/account/login-connections, then re-link the project to the GitHub repo. Until that's done, every deploy is manual.

### Database migrations

Always create new migration files (don't edit applied ones). Push with:

```bash
npx supabase db push
```

The CLI picks up files in `supabase/migrations/` in lexical order.

### Vercel environment variables

| Var | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon JWT | yes |
| `NEXT_PUBLIC_SITE_URL` | `https://myrealcpi.com` (anchors magic-link emails) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for cron | yes |
| `CRON_SECRET` | Bearer token for `/api/cron/ingest` | yes |
| `BLS_API_KEY` | Raises BLS rate limit 25 → 500/day | optional |
| `HCAPTCHA_SECRET` | Activates captcha gate on role applications | optional |
| `HCAPTCHA_SITEKEY` | Public hCaptcha site key | optional |

---

## Testing

### What's tested

| Surface | Tooling | What's covered |
|---|---|---|
| Pure helpers | Vitest | URL whitelist matching (incl. spoofing-attack cases), role guards, cross-country rule, moderator overrides |
| Type safety | `tsc --noEmit` | All app + ingestion + community code |
| Build correctness | `next build` | Each route compiles, server-action constraints satisfied |
| DB constraints | by inspection / observable behavior | RLS policies, CHECK constraints, BEFORE/AFTER triggers |
| End-to-end UI | manual smoke tests on prod | Sign-in flow, onboarding, dashboard render, cron route |

26 unit tests, all passing as of HEAD.

### Run them

```bash
npm test                    # one-shot
npm run test:watch          # watch mode
npx vitest run --coverage   # with coverage report (HTML at coverage/)
```

### Adding new tests

- Co-locate as `*.test.ts` next to the source file (Vitest config picks up `src/**/*.test.ts`).
- Keep tests pure — no DB, no network. Integration testing the DB via service-role queries is a future addition; for now, schema correctness is by inspection + production smoke tests.

---

## Where to look — file map

```
src/
├── app/
│   ├── page.tsx                         # Landing
│   ├── auth/callback/route.ts           # Magic-link callback
│   ├── onboarding/                      # Country picker + COICOP spending
│   ├── dashboard/                       # Personal CPI vs official + chart
│   ├── contribute/                      # Community contribution UI (apply, submit, review, approve)
│   ├── admin/                           # Moderator-gated tooling (applications, whitelist)
│   ├── api/cron/ingest/                 # Monthly auto-ingestion endpoint
│   ├── actions/                         # Server actions: auth, onboarding, community
│   ├── error.tsx, not-found.tsx, loading.tsx
│   ├── layout.tsx, globals.css
├── components/
│   └── SignInForm.tsx                   # Magic-link form
├── lib/
│   ├── supabase/                        # Browser, server, middleware clients
│   ├── cpi/calculate.ts                 # Personal CPI math (pure)
│   ├── ingestion/
│   │   ├── eurostat.ts                  # Full
│   │   ├── bls.ts                       # Full (with documented mapping caveats)
│   │   ├── oecd.ts                      # Stub (with full investigation)
│   │   ├── upsert.ts                    # Common batch upsert + YoY recompute
│   │   └── types.ts
│   ├── community/
│   │   ├── whitelist.ts + .test.ts      # Source-URL matching
│   │   ├── roles.ts + .test.ts          # Role guards, cross-country rule
│   │   ├── captcha.ts                   # hCaptcha (env-flagged)
│   │   └── types.ts
│   ├── format.ts                        # Locale-aware Intl.NumberFormat helpers
│   └── types.ts                         # DB row shapes
└── middleware.ts                        # Refreshes auth session on every request

supabase/
├── migrations/                          # Schema, RLS, seeds, triggers (sequential)
│   ├── 0001_init.sql                    # Core schema + RLS
│   ├── 0002_seed_coicop.sql             # 12 COICOP categories
│   ├── 0003_seed_countries.sql          # First country list
│   ├── 0004_seed_coicop_all_items.sql   # Adds the '00' headline category
│   ├── 0005_recompute_yoy.sql           # YoY function
│   ├── 0006_enable_us_bls.sql           # Flips US to is_supported=true
│   ├── 0007_add_region_and_all_countries.sql  # Adds region column + 130 missing countries
│   ├── 0008_community_contributions_init.sql  # Tables, RLS, triggers for community pipeline
│   ├── 0009_seed_moderator_and_whitelist.sql  # Founder + initial whitelist
│   └── 0010_auto_promote_founder.sql    # auth.users trigger
├── config.toml                          # Supabase CLI config
└── README.md

vercel.json                              # Cron schedule (5th of each month, 06:00 UTC)
vitest.config.ts                         # Test config
.env.example                             # Documented env-var template
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Country dropdown only shows ~60 countries | Migration 0007 wasn't applied | `npx supabase db push` |
| Magic-link click leads to a broken page | `NEXT_PUBLIC_SITE_URL` mismatch (set to a domain that doesn't resolve) | Update Vercel env var or wait for DNS |
| Cron returns `{rows: 0, error: "Eurostat HTTP 4xx"}` | Eurostat dimension key broke (rare; their API has changed before) | Probe directly with `curl -H "Accept: application/json"`, fix the key construction in `src/lib/ingestion/eurostat.ts` |
| Cron returns `{rows: 0}` for BLS | BLS rate limit (25/day) hit without `BLS_API_KEY` | Set the env var, redeploy |
| Community submission fails with `cross-country rule violated` | The would-be reviewer/approver is also a contributor for that country | Pick a different reviewer/approver |
| Community submission fails with `domain not on the approved list` | Source URL's host isn't (a subdomain of) any whitelisted domain for that country | As moderator, add the domain at `/admin/whitelist` |
| `auth.users` trigger fires but no moderator row appears | Founder hasn't signed up yet | Sign up with the founding email; the trigger fires on first INSERT into `auth.users` |
| Tests fail after a schema change | Pure-function tests don't talk to the DB, so they shouldn't be affected | Check the test diff; if a type changed, update the unit tests |

---

## Roadmap and explicitly deferred work

| Item | Status | Notes |
|---|---|---|
| OECD ingester | **Deferred indefinitely** | Both relevant dataflows are dead ends. See investigation in `src/lib/ingestion/oecd.ts`. |
| Per-country stat office ingesters | Future | Statistics Canada is the natural first target (clean REST API, English docs, monthly cadence, no API key). |
| Refined US BLS COICOP mapping | Future | Use BLS "relative importance" weights to compute weighted aggregates for COICOP 02, 04, 11. ~30 min when ready. |
| 12-month personal-CPI line chart | Deferred | Explicit user choice; can add as a separate dashboard panel later. |
| Disputed-territories policy | Required before community contribs in those regions | Pick a defensible rule for Taiwan, Palestine, Western Sahara, Crimea, Kosovo upfront. |
| GitHub-Vercel auto-deploy | Manual today | Connect at https://vercel.com/account/login-connections; deploys then fire on push to `master`. |
| Integration tests against the DB | Future | Pure helpers are unit-tested; constraint correctness is by inspection. A future improvement is a service-role-driven integration test that exercises every RLS policy and trigger. |

---

## Glossary

- **COICOP** — Classification of Individual Consumption by Purpose. The international standard that all CPI publishers use, with 12 top-level divisions plus a `00` "all items" headline.
- **HICP** — Harmonised Index of Consumer Prices. Eurostat's harmonised CPI methodology used across EU member states.
- **YoY** — Year-on-year. A percentage change from the same period 12 months earlier.
- **RLS** — Row Level Security. Postgres feature that constrains row visibility per query based on the current authenticated user, used heavily here.
- **The triad** — informal name for the cross-country contribution pipeline: contributor in country X, reviewer not in X, approver in a third country.
