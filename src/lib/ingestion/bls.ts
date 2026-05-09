// US BLS CPI ingestion.
//
// API: https://api.bls.gov/publicAPI/v2/timeseries/data/  (POST, JSON)
// Docs: https://www.bls.gov/developers/api_signature_v2.htm
//
// The public API works with no key (25 queries/day) or with a free key
// (BLS_API_KEY env, 500 queries/day). The cron only runs ~once a month, so
// the unauthenticated tier is fine and we send the key when present.
//
// COICOP-12 mapping. BLS publishes CPI-U for U.S. city average (CUUR series,
// NSA, base 1982-84=100). The mapping below isn't 1:1 — BLS major groups
// don't split exactly the way COICOP does. Notable approximations:
//   - 02 (Alcohol & tobacco): only alcohol (SEFW). Tobacco lives inside SAG.
//   - 04 (Housing & utilities) → SAH, which also rolls up household
//     furnishings (SAH3). We map 05 separately to SAH3, which slightly
//     overweights furnishings in the user's personal CPI sum.
//   - 11 (Restaurants & hotels): "Food away from home" only (SEFV); BLS
//     doesn't carry a clean accommodation index.
//   - 12 (Insurance & financial): SAG (Other goods & services), broadest
//     proxy.
//
// These limitations are documented for users on the dashboard via the
// `cpi_index.source = 'bls'` flag; future work can refine the mapping with
// weighted aggregation across BLS subseries.

import type { IngestRow } from "./types";

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

// COICOP code -> BLS CUUR series ID
const COICOP_TO_BLS: Record<string, string> = {
  "00": "CUUR0000SA0",   // All items
  "01": "CUUR0000SAF1",  // Food
  "02": "CUUR0000SEFW",  // Alcoholic beverages (tobacco gap)
  "03": "CUUR0000SAA",   // Apparel
  "04": "CUUR0000SAH",   // Housing
  "05": "CUUR0000SAH3",  // Household furnishings & operations
  "06": "CUUR0000SAM",   // Medical care
  "07": "CUUR0000SAT",   // Transportation
  "08": "CUUR0000SEEC",  // Communication
  "09": "CUUR0000SAR",   // Recreation
  "10": "CUUR0000SEEB",  // Education
  "11": "CUUR0000SEFV",  // Food away from home (proxy for restaurants/hotels)
  "12": "CUUR0000SAG",   // Other goods and services
};

const BLS_TO_COICOP: Record<string, string> = Object.fromEntries(
  Object.entries(COICOP_TO_BLS).map(([k, v]) => [v, k]),
);

type BlsObs = {
  year: string;
  period: string; // "M01".."M12" for monthly, "M13" annual avg
  periodName: string;
  value: string; // numeric string
  footnotes: { code?: string; text?: string }[];
};

type BlsSeries = {
  seriesID: string;
  data: BlsObs[];
};

type BlsResponse = {
  status: string;
  message?: string[];
  Results?: { series: BlsSeries[] };
};

export async function fetchBlsCpi({
  lookbackMonths = 24,
  fetchImpl = fetch,
}: {
  lookbackMonths?: number;
  fetchImpl?: typeof fetch;
} = {}): Promise<IngestRow[]> {
  const now = new Date();
  const startYear = String(now.getUTCFullYear() - Math.ceil(lookbackMonths / 12));
  const endYear = String(now.getUTCFullYear());

  const body: Record<string, unknown> = {
    seriesid: Object.values(COICOP_TO_BLS),
    startyear: startYear,
    endyear: endYear,
  };
  if (process.env.BLS_API_KEY) body.registrationkey = process.env.BLS_API_KEY;

  const res = await fetchImpl(BLS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`BLS HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as BlsResponse;
  if (data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS status=${data.status}: ${(data.message || []).join("; ")}`);
  }

  const rows: IngestRow[] = [];
  for (const s of data.Results?.series ?? []) {
    const coicop = BLS_TO_COICOP[s.seriesID];
    if (!coicop) continue;
    for (const obs of s.data) {
      // Skip annual averages (M13) and any period that isn't a real month.
      if (!/^M(0[1-9]|1[0-2])$/.test(obs.period)) continue;
      const month = obs.period.slice(1).padStart(2, "0");
      const value = Number(obs.value);
      if (!Number.isFinite(value)) continue;
      rows.push({
        country_code: "US",
        category_code: coicop,
        period: `${obs.year}-${month}-01`,
        index_value: value,
        source: "bls",
      });
    }
  }
  return rows;
}
