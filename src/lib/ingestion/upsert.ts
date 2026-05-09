import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestRow } from "./types";

const CHUNK = 500; // safe payload size for Supabase upserts

export async function upsertCpiRows(
  supabase: SupabaseClient,
  rows: IngestRow[],
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      country_code: r.country_code,
      category_code: r.category_code,
      period: r.period,
      index_value: r.index_value,
      source: r.source,
      // yoy_pct deliberately left null; recomputed in SQL after all sources land.
    }));

    const { error, count } = await supabase
      .from("cpi_index")
      .upsert(batch, { onConflict: "country_code,category_code,period", count: "exact" });

    if (error) {
      errors.push(`batch ${i}: ${error.message}`);
      continue;
    }
    upserted += count ?? batch.length;
  }
  return { upserted, errors };
}

export async function recomputeYoy(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("recompute_cpi_yoy");
  if (error) throw new Error(`recompute_cpi_yoy: ${error.message}`);
}
