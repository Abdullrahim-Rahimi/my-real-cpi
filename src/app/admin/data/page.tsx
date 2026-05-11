import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  CoicopCategory,
  Country,
  CpiIndexRow,
} from "@/lib/types";

const SOURCE_STYLES: Record<string, string> = {
  eurostat:
    "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  bls:
    "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  oecd:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  community:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const MAX_PERIODS = 24;

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: rawCountry } = await searchParams;
  const supabase = createServiceClient();

  // List of every country that has at least one row in cpi_index, with how
  // many cells we have for it and what the latest period is.
  const { data: index } = await supabase
    .from("cpi_index")
    .select("country_code, period, source")
    .order("period", { ascending: false })
    .returns<CpiIndexRow[]>();
  type Stat = {
    country_code: string;
    rows: number;
    latest: string;
    sources: Set<string>;
  };
  const stats = new Map<string, Stat>();
  for (const r of index ?? []) {
    if (!stats.has(r.country_code)) {
      stats.set(r.country_code, {
        country_code: r.country_code,
        rows: 0,
        latest: r.period,
        sources: new Set(),
      });
    }
    const s = stats.get(r.country_code)!;
    s.rows++;
    s.sources.add(r.source);
    if (r.period > s.latest) s.latest = r.period;
  }

  // Country names for the dropdown + table headers.
  const { data: countriesData } = await supabase
    .from("countries")
    .select("code, iso3, name, currency, cpi_source, is_supported, region")
    .order("name", { ascending: true })
    .returns<Country[]>();
  const countryByCode = new Map<string, Country>();
  for (const c of countriesData ?? []) countryByCode.set(c.code, c);

  // Default to the first country with data (alphabetically) if none picked.
  const defaultCountry =
    rawCountry ??
    Array.from(stats.values())
      .map((s) => s.country_code)
      .sort(
        (a, b) =>
          (countryByCode.get(a)?.name ?? a).localeCompare(
            countryByCode.get(b)?.name ?? b,
          ),
      )[0];

  // Pull the full grid for the selected country.
  const { data: categories } = await supabase
    .from("coicop_categories")
    .select("code, name, short_name, description, display_order")
    .order("display_order", { ascending: true })
    .returns<CoicopCategory[]>();
  const cats = (categories ?? []).sort(
    (a, b) => a.display_order - b.display_order,
  );

  const { data: cells } = defaultCountry
    ? await supabase
        .from("cpi_index")
        .select(
          "country_code, category_code, period, index_value, yoy_pct, source, fetched_at",
        )
        .eq("country_code", defaultCountry)
        .order("period", { ascending: false })
        .returns<CpiIndexRow[]>()
    : { data: [] as CpiIndexRow[] };

  // Group into a (period × category) grid.
  const periods = Array.from(
    new Set((cells ?? []).map((c) => c.period)),
  ).slice(0, MAX_PERIODS);
  const grid = new Map<string, Map<string, CpiIndexRow>>(); // period -> (cat -> row)
  for (const c of cells ?? []) {
    if (!grid.has(c.period)) grid.set(c.period, new Map());
    grid.get(c.period)!.set(c.category_code, c);
  }

  const summaryRows = Array.from(stats.values()).sort((a, b) =>
    (countryByCode.get(a.country_code)?.name ?? a.country_code).localeCompare(
      countryByCode.get(b.country_code)?.name ?? b.country_code,
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">CPI data</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Every approved CPI cell in the database. Pick a country to see its
        full periods × categories grid.
      </p>

      {/* Country index */}
      <section className="mt-6 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Countries with data
        </h2>
        {summaryRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Nothing in cpi_index yet. Run the cron or wait for a community
            submission to be approved.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {summaryRows.map((s) => {
              const country = countryByCode.get(s.country_code);
              const isSelected = s.country_code === defaultCountry;
              return (
                <Link
                  key={s.country_code}
                  href={`/admin/data?country=${s.country_code}`}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-black/10 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800")
                  }
                >
                  {country?.name ?? s.country_code}
                  <span className="ml-2 opacity-70">{s.rows}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected country detail */}
      {defaultCountry && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">
            {countryByCode.get(defaultCountry)?.name ?? defaultCountry}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {periods.length} {periods.length === 1 ? "period" : "periods"} ·
            sources:{" "}
            {Array.from(stats.get(defaultCountry)?.sources ?? []).join(", ") ||
              "—"}
          </p>

          {periods.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 text-center text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
              No cells for this country.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <tr>
                    <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
                      Period
                    </th>
                    {cats.map((c) => (
                      <th
                        key={c.code}
                        className="px-3 py-3 text-right font-medium"
                        title={c.name}
                      >
                        <div className="font-mono text-[10px] text-zinc-400">
                          {c.code}
                        </div>
                        <div className="text-[11px] normal-case">
                          {c.short_name}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {periods.map((p) => {
                    // Pick the row's source from any non-null cell.
                    const cellsThisPeriod = grid.get(p) ?? new Map();
                    const aSource = Array.from(cellsThisPeriod.values())[0]
                      ?.source;
                    return (
                      <tr key={p} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2 text-xs font-medium dark:bg-zinc-900/60">
                          {new Date(p).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        {cats.map((c) => {
                          const cell = cellsThisPeriod.get(c.code);
                          if (!cell) {
                            return (
                              <td
                                key={c.code}
                                className="px-3 py-2 text-right text-zinc-300 dark:text-zinc-700"
                              >
                                —
                              </td>
                            );
                          }
                          return (
                            <td
                              key={c.code}
                              className="px-3 py-2 text-right tabular-nums"
                            >
                              <div className="text-zinc-900 dark:text-zinc-100">
                                {Number(cell.index_value).toFixed(2)}
                              </div>
                              <div
                                className={
                                  "text-[10px] " +
                                  (cell.yoy_pct == null
                                    ? "text-zinc-400"
                                    : Number(cell.yoy_pct) >= 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-emerald-700 dark:text-emerald-400")
                                }
                              >
                                {cell.yoy_pct == null
                                  ? "no YoY"
                                  : `${Number(cell.yoy_pct) > 0 ? "+" : ""}${Number(cell.yoy_pct).toFixed(2)}%`}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right">
                          {aSource && (
                            <span
                              className={
                                "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                (SOURCE_STYLES[aSource] ??
                                  "bg-zinc-200 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300")
                              }
                            >
                              {aSource}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {periods.length === MAX_PERIODS && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Showing the latest {MAX_PERIODS} periods. Older history exists
              but isn&apos;t rendered.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
