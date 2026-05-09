export type CpiSource = "oecd" | "eurostat" | "bls";

export type IngestRow = {
  country_code: string; // ISO 3166-1 alpha-2
  category_code: string; // '00' .. '12'
  period: string; // ISO date, first day of the month, YYYY-MM-01
  index_value: number; // index level (any base — YoY is computed in SQL afterwards)
  source: CpiSource;
};

export type IngestResult = {
  source: CpiSource;
  rows: number;
  countries: string[];
  error?: string;
};
