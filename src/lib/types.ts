// Database row shapes. Mirrors supabase/migrations/0001_init.sql.
// (We don't run `supabase gen types` yet; revisit once the schema settles.)

export type Country = {
  code: string;
  iso3: string;
  name: string;
  currency: string | null;
  cpi_source: "oecd" | "eurostat" | "bls" | null;
  is_supported: boolean;
  region: string;
};

export type CoicopCategory = {
  code: string;
  name: string;
  short_name: string;
  description: string | null;
  display_order: number;
};

export type CpiIndexRow = {
  country_code: string;
  category_code: string;
  period: string; // ISO date
  index_value: number;
  yoy_pct: number | null;
  source: string;
  fetched_at: string;
};

export type UserProfile = {
  user_id: string;
  country_code: string | null;
  display_name: string | null;
  currency: string | null;
  onboarded_at: string | null;
  notify_personal_cpi: boolean;
};

export type UserSpendingRow = {
  user_id: string;
  category_code: string;
  monthly_amount: number;
};
