import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computePersonalCpi } from "@/lib/cpi/calculate";
import { formatCurrency, formatPercent, formatPeriod } from "@/lib/format";
import {
  activeContributorCountry,
  hasActiveRole,
} from "@/lib/community/roles";
import type {
  CountryContributorRow,
} from "@/lib/community/types";
import type {
  CoicopCategory,
  Country,
  CpiIndexRow,
  UserSpendingRow,
} from "@/lib/types";
import { CategoryBreakdownChart } from "./DashboardCharts";
import { NotifyToggle } from "./NotifyToggle";
import { signOut } from "@/app/actions/auth";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, country_code, display_name, currency, onboarded_at, notify_personal_cpi")
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

  // Community role state and queue counts. Fetched here so the dashboard can
  // surface "you have N pending reviews" / "1 batch awaiting approval" banners
  // and gentle nudges to apply if the user's country is unsupported.
  const { data: roleRows } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();
  const myRoles = roleRows ?? [];
  const myContribCountry = activeContributorCountry(myRoles);
  const isReviewer =
    hasActiveRole(myRoles, "reviewer") || hasActiveRole(myRoles, "moderator");
  const isApprover =
    hasActiveRole(myRoles, "approver") || hasActiveRole(myRoles, "moderator");

  let pendingReviewCount = 0;
  let pendingApprovalCount = 0;
  if (isReviewer) {
    let q = supabase
      .from("cpi_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review");
    if (myContribCountry) q = q.neq("country_code", myContribCountry);
    const { count } = await q;
    pendingReviewCount = count ?? 0;
  }
  if (isApprover) {
    let q = supabase
      .from("cpi_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .neq("reviewer_id", user.id);
    if (myContribCountry) q = q.neq("country_code", myContribCountry);
    const { count } = await q;
    pendingApprovalCount = count ?? 0;
  }

  // The contributor's own most recent submission status — so they see when
  // their batch moves through the pipeline without having to check manually.
  let myLatestSubmission: { status: string; period: string } | null = null;
  if (myContribCountry) {
    const { data } = await supabase
      .from("cpi_submissions")
      .select("status, period, submitted_at")
      .eq("submitted_by", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) myLatestSubmission = { status: data.status, period: data.period };
  }

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
          <Link
            href="/contribute"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Contribute
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
          {result.period ? ` · ${formatPeriod(result.period)}` : ""}
        </p>

        {/* Role-aware queue banners (only render if there's something pending). */}
        {(pendingReviewCount > 0 || pendingApprovalCount > 0) && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {pendingReviewCount > 0 && (
              <Link
                href="/contribute/review"
                className="flex flex-1 items-center justify-between rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-sm transition hover:border-emerald-600/40 dark:border-emerald-500/30 dark:bg-emerald-950/30"
              >
                <span className="text-emerald-900 dark:text-emerald-100">
                  <strong>{pendingReviewCount}</strong>{" "}
                  {pendingReviewCount === 1 ? "submission" : "submissions"} waiting on your review
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">→</span>
              </Link>
            )}
            {pendingApprovalCount > 0 && (
              <Link
                href="/contribute/approve"
                className="flex flex-1 items-center justify-between rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-sm transition hover:border-emerald-600/40 dark:border-emerald-500/30 dark:bg-emerald-950/30"
              >
                <span className="text-emerald-900 dark:text-emerald-100">
                  <strong>{pendingApprovalCount}</strong>{" "}
                  {pendingApprovalCount === 1 ? "submission" : "submissions"} ready for your approval
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">→</span>
              </Link>
            )}
          </div>
        )}

        {/* Personal contributor's own batch status (if they've submitted recently). */}
        {myLatestSubmission && myLatestSubmission.status !== "live" && (
          <div className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
            <span className="text-zinc-600 dark:text-zinc-400">
              Your{" "}
              {new Date(myLatestSubmission.period).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}{" "}
              submission is{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {myLatestSubmission.status.replace(/_/g, " ")}
              </span>
              .
            </span>
          </div>
        )}

        {!hasData ? (
          <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-950/30">
            <h2 className="text-xl font-semibold">CPI data is refreshing</h2>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              We don&apos;t yet have CPI by category for {country?.name}. Our
              auto-ingest covers ~33 countries; for the rest, the community
              keeps data fresh through the contributor pipeline.
            </p>
            <p className="mt-3 text-sm">
              <Link
                href="/contribute"
                className="font-medium text-amber-900 underline underline-offset-2 hover:opacity-80 dark:text-amber-100"
              >
                Help bring {country?.name} online →
              </Link>
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
                  {formatPercent(result.personal_yoy_pct)}
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
                  {formatPercent(result.official_yoy_pct)}
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

            <details className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
              <summary className="cursor-pointer select-none font-medium">
                Why is mine different from the official rate?
              </summary>
              <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-400">
                <p>
                  The official CPI is a weighted average for the whole country,
                  using a basket designed to represent average household
                  spending. Your actual spending isn&apos;t average — so the
                  inflation you experience usually isn&apos;t either.
                </p>
                <p>
                  We compute your personal CPI as{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
                    Σ (your weight × YoY for that category)
                  </code>
                  , using the same official category indices the headline number
                  is built on. If you spend more than average on fast-rising
                  categories (housing, food), your real CPI runs hotter. If you
                  spend more on slow-rising ones (clothing, communication), it
                  runs cooler.
                </p>
              </div>
            </details>

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
                          {formatCurrency(b.user_amount, currency)}
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
                          {formatPercent(b.yoy_pct, 2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPercent(b.contribution_pct, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Notification preferences */}
        <section className="mt-12 rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
          <h2 className="text-lg font-semibold">Email preferences</h2>
          <div className="mt-3">
            <NotifyToggle
              initialEnabled={profile?.notify_personal_cpi ?? true}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
