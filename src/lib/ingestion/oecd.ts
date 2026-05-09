// OECD CPI ingestion — INTENTIONAL STUB. Do not wire up without revisiting.
//
// I probed OECD's SDMX 3.0 prices API end-to-end (sdmx.oecd.org) for the
// non-EU OECD members we care about (CA, AU, NZ, JP, KR, IL, MX, CL, CO, CR).
// Two relevant dataflows exist; both are dead ends for our use case:
//
//   - DSD_PRICES@DF_PRICES_ALL (COICOP 1999): full CP01..CP12 breakdown, but
//     the dataset is FROZEN — last observation is 2021-06. OECD stopped
//     updating COICOP-1999 series and migrated to COICOP-2018.
//
//   - DSD_PRICES_COICOP2018@DF_PRICES_C2018_ALL (COICOP 2018): updated through
//     this month, but for non-EU members the EXPENDITURE constraint exposes
//     only ~2 of 12 divisions (typically _T headline + CP01 food, plus a few
//     aggregates like GD/SERV). The full per-division breakdown only exists
//     for countries Eurostat already covers, which we get via Eurostat HICP
//     directly.
//
// Net: OECD does not give us the COICOP-12 breakdown the dashboard needs for
// JP/KR/CA/AU/NZ/etc. To support those countries we'd need per-country
// national stat office integrations (e.g. Statistics Bureau of Japan,
// Statistics Canada, ABS, etc.) — one ingester per country.
//
// Until that work is done, those countries stay is_supported=false and the
// dashboard shows "CPI data is refreshing" for users who pick them.

import type { IngestRow } from "./types";

export async function fetchOecdCpi(_countryCodes: string[]): Promise<IngestRow[]> {
  return [];
}
