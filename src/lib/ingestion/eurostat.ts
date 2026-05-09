// Eurostat HICP ingestion.
//
// Dataset: prc_hicp_midx (Harmonised Index of Consumer Prices, monthly index)
// Docs:    https://ec.europa.eu/eurostat/databrowser/view/PRC_HICP_MIDX
// API:     https://ec.europa.eu/eurostat/web/main/data/web-services
//
// The SDMX 2.1 endpoint uses path-based dimension keys
// (freq.unit.coicop.geo, dotted, "+"-separated within a dimension) and
// returns JSON-stat 2.0 when called with `Accept: application/json` plus
// `?lang=EN`. We pull ~24 months in one request and flatten the sparse
// multidimensional array into (country, category, month) rows.

import type { IngestRow } from "./types";

const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/prc_hicp_midx";

// Eurostat HICP COICOP codes are CP00..CP12; we strip the "CP" prefix to match
// our coicop_categories.code values.
const HICP_COICOP_CODES = [
  "CP00",
  "CP01",
  "CP02",
  "CP03",
  "CP04",
  "CP05",
  "CP06",
  "CP07",
  "CP08",
  "CP09",
  "CP10",
  "CP11",
  "CP12",
];

// Eurostat uses non-ISO codes for a few countries.
// (UK instead of GB, EL instead of GR.)
const ISO_TO_EUROSTAT: Record<string, string> = { GB: "UK", GR: "EL" };
const EUROSTAT_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_TO_EUROSTAT).map(([k, v]) => [v, k]),
);

const toEurostatGeo = (iso: string) => ISO_TO_EUROSTAT[iso] ?? iso;
const toIsoGeo = (eu: string) => EUROSTAT_TO_ISO[eu] ?? eu;

type JsonStatResponse = {
  id: string[]; // dimension order, e.g. ["freq","unit","coicop","geo","time"]
  size: number[]; // size of each dimension
  dimension: Record<
    string,
    { category: { index: Record<string, number>; label: Record<string, string> } }
  >;
  // value can be a dense array or a sparse object keyed by flat index strings.
  value: number[] | Record<string, number>;
};

export async function fetchEurostatHicp({
  countryCodes,
  lookbackMonths = 24,
  fetchImpl = fetch,
}: {
  countryCodes: string[];
  lookbackMonths?: number;
  fetchImpl?: typeof fetch;
}): Promise<IngestRow[]> {
  if (countryCodes.length === 0) return [];

  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - lookbackMonths);
  const startPeriod = `${start.getUTCFullYear()}-${String(
    start.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  const eurostatGeo = countryCodes.map(toEurostatGeo);

  // SDMX dimension key: freq.unit.coicop.geo, dotted, "+" separates values
  // within a dimension. The "+" is a literal in the URL path (not %2B).
  const key = [
    "M",
    "I15",
    HICP_COICOP_CODES.join("+"),
    eurostatGeo.join("+"),
  ].join(".");

  // Build URL: encodeURIComponent would mangle the "+" into %2B. Build manually.
  const url =
    `${EUROSTAT_BASE}/${key}/?lang=EN&startPeriod=${encodeURIComponent(startPeriod)}`;

  const res = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Eurostat HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as JsonStatResponse;
  return parseJsonStat(data);
}

function parseJsonStat(data: JsonStatResponse): IngestRow[] {
  const dimIds = data.id;
  const sizes = data.size;
  const dim = data.dimension;

  // Build [position -> code] arrays for each dimension.
  const codeAt = dimIds.map((id) => {
    const idx = dim[id]?.category?.index ?? {};
    const arr: string[] = [];
    for (const [code, pos] of Object.entries(idx)) arr[pos] = code;
    return arr;
  });

  // Multipliers for row-major flat index: multipliers[k] = product of sizes[k+1..]
  const multipliers = sizes.map((_, i) =>
    sizes.slice(i + 1).reduce((a, b) => a * b, 1),
  );

  const geoIdx = dimIds.indexOf("geo");
  const coicopIdx = dimIds.indexOf("coicop");
  const timeIdx = dimIds.indexOf("time");
  if (geoIdx < 0 || coicopIdx < 0 || timeIdx < 0) {
    throw new Error("Eurostat response missing geo/coicop/time dimension");
  }

  const dense = Array.isArray(data.value);
  const valueArr = data.value as number[];
  const valueObj = data.value as Record<string, number>;

  const rows: IngestRow[] = [];
  const indices = sizes.map(() => 0);

  for (let g = 0; g < sizes[geoIdx]; g++) {
    for (let c = 0; c < sizes[coicopIdx]; c++) {
      for (let t = 0; t < sizes[timeIdx]; t++) {
        indices[geoIdx] = g;
        indices[coicopIdx] = c;
        indices[timeIdx] = t;
        let flat = 0;
        for (let k = 0; k < sizes.length; k++) flat += indices[k] * multipliers[k];

        const v = dense ? valueArr[flat] : valueObj[String(flat)];
        if (v == null || !Number.isFinite(v)) continue;

        const eurostatGeo = codeAt[geoIdx][g];
        const coicop = codeAt[coicopIdx][c];
        const ymd = codeAt[timeIdx][t]; // "YYYY-MM"
        if (!eurostatGeo || !coicop || !ymd) continue;

        rows.push({
          country_code: toIsoGeo(eurostatGeo),
          category_code: coicop.replace(/^CP/, ""),
          period: `${ymd}-01`,
          index_value: Number(v),
          source: "eurostat",
        });
      }
    }
  }

  return rows;
}
