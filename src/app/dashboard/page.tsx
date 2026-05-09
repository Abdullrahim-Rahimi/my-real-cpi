import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computePersonalCpi } from "@/lib/cpi/calculate";
import type {
  CoicopCategory,
  Country,
  CpiIndexRow,
  UserSpendingRow,
} from "@/lib/types";
import { CategoryBreakdownChart } from "./DashboardCharts";
import { signOut } from "@/app/actions/auth";

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtPeriod(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, country_code, display_name, currency, onboarded_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at || !profile.country_code) {
    redirect("/onboarding");
  }

  const [{ data: country }, { data: categories }, { data: spending }] =
    await Promise.all([
      supabase
        .from("countries")
        .select("code, iso3, name, currency, cpi_source, is_supported")
        .eq("code", profile.country_code)
        .maybeSingle<Country>(),
      supabase
        .from("coicop_categories")
        .select("code, name, short_name, description, display_order")
        .order("display_order", { ascending: true })
        .returns<CoicopCategory[]>(),
      supabase
        .from("user_spending")
        .select("user_id, category_code, monthly_amount")
        .eq("user_id", user.id)
        .returns<UserSpendingRow[]>(),
    ]);

  // Latest CPI row per category for this country.
  const { data: cpiRows } = await supabase
    .from("cpi_index")
    .select("country_code, category_code, period, index_value, yoy_pct, source, fetched_at")
    .eq("country_code", profile.country_code)
    .order("period", { ascending: false })
    .returns<CpiIndexRow[]>();

  const latestByCat = new Map<string, { yoy_pct: number | null; period: string }>();
  for (const row of cpiRows ?? []) {
    if (!latestByCat.has(row.category_code)) {
      latestByCat.set(row.category_code, {
        yoy_pct: row.yoy_pct == null ? null : Number(row.yoy_pct),
        period: row.period,
      });
    }
  }

  const spendingMap = new Map<string, number>();
  for (const row of spending ?? []) {
    spendingMap.set(row.category_code, Number(row.monthly_amount));
  }

  const divisions = (categories ?? []).filter((c) => c.display_order > 0);
  const result = computePersonalCpi({
    categories: divisions,
    spending: spendingMap,
    cpiByCategory: latestByCat,
  });

  const hasData = result.breakdown.length > 0;
  const currency = profile.currency ?? country?.currency ?? "";

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/onboarding"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Edit spending
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {country?.name}
          {result.period ? ` · ${fmtPeriod(result.period)}` : ""}
        </p>

        {!hasData ? (
          <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-950/30">
            <h2 className="text-xl font-semibold">CPI data is refreshing</h2>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              We don&apos;t yet have CPI by category for {country?.name}. Our
              monthly ingestion job runs on the 1st of each month — your real
              CPI will appear here as soon as official data lands.
            </p>
          </div>
        ) : (
          <>
            {/* Hero numbers */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-600/20 bg-emerald-50 p-6 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Your Real CPI (year-on-year)
                </p>
                <p className="mt-2 text-5xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                  {fmtPct(result.personal_yoy_pct)}
                </p>
                <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                  Based on your spending mix · coverage{" "}
                  {(result.coverage_pct * 100).toFixed(0)}%
                </p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Official headline CPI
                </p>
                <p className="mt-2 text-5xl font-semibold tabular-nums">
                  {fmtPct(result.official_yoy_pct)}
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {country?.cpi_source
                    ? `Source: ${country.cpi_source.toUpperCase()}`
                    : "Source: official statistics"}
                </p>
              </div>
            </div>

            {result.official_yoy_pct != null && (
              <div className="mt-4 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                {result.personal_yoy_pct > result.official_yoy_pct
                  ? `You're feeling inflation about ${(result.personal_yoy_pct - result.official_yoy_pct).toFixed(1)} pp more than the official rate — your basket leans into faster-rising categories.`
                  : `You're feeling inflation about ${(result.official_yoy_pct - result.personal_yoy_pct).toFixed(1)} pp less than the official rate — your basket leans into slower-rising categories.`}
              </div>
            )}

            {/* Breakdown chart */}
            <section className="mt-10">
              <h2 className="text-xl font-semibold">By category</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Year-on-year inflation per category. Bars in red are running
                hotter than the official headline; green are cooler.
              </p>
              <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
                <CategoryBreakdownChart
                  breakdown={result.breakdown}
                  officialYoy={result.official_yoy_pct}
                  personalYoy={result.personal_yoy_pct}
                />
              </div>
            </section>

            {/* Detail table */}
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Contribution to your CPI</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                How much each category contributes to your personal inflation
                rate (weight × YoY).
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Your spend</th>
                      <th className="px-4 py-3 text-right">Weight</th>
                      <th className="px-4 py-3 text-right">YoY</th>
                      <th className="px-4 py-3 text-right">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/10">
                    {result.breakdown.map((b) => (
                      <tr key={b.code}>
                        <td className="px-4 py-3 font-medium">{b.short_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {currency} {b.user_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {(b.user_weight * 100).toFixed(1)}%
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            b.yoy_pct > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {fmtPct(b.yoy_pct, 2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtPct(b.contribution_pct, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
