// Monthly CPI ingestion. Triggered by Vercel Cron (see vercel.json) on the
// 1st of each month. Can also be invoked manually for testing:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://myrealcpi.com/api/cron/ingest
//
// Idempotent: re-running just refreshes the same rows.

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchEurostatHicp } from "@/lib/ingestion/eurostat";
import { fetchOecdCpi } from "@/lib/ingestion/oecd";
import { fetchBlsCpi } from "@/lib/ingestion/bls";
import { recomputeYoy, upsertCpiRows } from "@/lib/ingestion/upsert";
import type { IngestResult, IngestRow } from "@/lib/ingestion/types";
import type { Country } from "@/lib/types";

type RunResult = IngestResult & { rowsRaw: IngestRow[] };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // seconds — Vercel hobby cap

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  // Vercel Cron also supports a query-param fallback for testing.
  const qp = req.nextUrl.searchParams.get("secret");
  return qp === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch the supported-country list, partitioned by source.
  const { data: countries, error: cErr } = await supabase
    .from("countries")
    .select("code, iso3, name, currency, cpi_source, is_supported")
    .eq("is_supported", true)
    .returns<Country[]>();
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const byCpiSource = (s: Country["cpi_source"]) =>
    (countries ?? []).filter((c) => c.cpi_source === s).map((c) => c.code);

  const eurostatCountries = byCpiSource("eurostat");
  const oecdCountries = byCpiSource("oecd");
  const blsCountries = byCpiSource("bls");

  // Run sources in parallel; collect successes and failures independently.
  const results: RunResult[] = await Promise.all([
    runSource("eurostat", eurostatCountries, () =>
      fetchEurostatHicp({ countryCodes: eurostatCountries }),
    ),
    runSource("oecd", oecdCountries, () => fetchOecdCpi(oecdCountries)),
    runSource("bls", blsCountries, () => fetchBlsCpi({})),
  ]);

  // Upsert all rows from all sources together.
  const allRows = results.flatMap((r) => r.rowsRaw);
  let upserted = 0;
  const upsertErrors: string[] = [];

  if (allRows.length > 0) {
    const r = await upsertCpiRows(supabase, allRows);
    upserted = r.upserted;
    upsertErrors.push(...r.errors);
  }

  // Recompute YoY for everything.
  let yoyError: string | null = null;
  try {
    await recomputeYoy(supabase);
  } catch (e) {
    yoyError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: upsertErrors.length === 0 && yoyError == null,
    sources: results.map(({ rowsRaw: _r, ...rest }) => rest),
    upserted,
    upsertErrors,
    yoyError,
    timestamp: new Date().toISOString(),
  });
}

async function runSource(
  source: IngestResult["source"],
  countries: string[],
  fetcher: () => Promise<IngestRow[]>,
): Promise<RunResult> {
  if (countries.length === 0) {
    return { source, rows: 0, countries: [], rowsRaw: [] };
  }
  try {
    const rows = await fetcher();
    return { source, rows: rows.length, countries, rowsRaw: rows };
  } catch (e) {
    return {
      source,
      rows: 0,
      countries,
      error: e instanceof Error ? e.message : String(e),
      rowsRaw: [],
    };
  }
}
