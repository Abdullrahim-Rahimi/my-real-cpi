import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeContributorCountry } from "@/lib/community/roles";
import type {
  CountryContributorRow,
  CpiSubmissionRow,
  CpiSubmissionStatus,
  SourceWhitelistRow,
} from "@/lib/community/types";
import type { CoicopCategory, Country } from "@/lib/types";
import { SubmitCpiForm } from "./SubmitCpiForm";
import { WithdrawPendingButton } from "./WithdrawPendingButton";
import { signOut } from "@/app/actions/auth";

export default async function ContributeSubmitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/contribute/submit");

  const { data: roles } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();

  const country_code = activeContributorCountry(roles ?? []);
  if (!country_code) {
    redirect("/contribute?reason=not_contributor");
  }

  const [{ data: country }, { data: categories }, { data: whitelist }, { data: mySubmissions }] =
    await Promise.all([
      supabase
        .from("countries")
        .select("code, iso3, name, currency, cpi_source, is_supported, region")
        .eq("code", country_code)
        .maybeSingle<Country>(),
      supabase
        .from("coicop_categories")
        .select("code, name, short_name, description, display_order")
        .order("display_order", { ascending: true })
        .returns<CoicopCategory[]>(),
      supabase
        .from("country_source_whitelist")
        .select("country_code, domain, description, added_by, added_at")
        .eq("country_code", country_code)
        .returns<SourceWhitelistRow[]>(),
      supabase
        .from("cpi_submissions")
        .select("country_code, period, status, submitted_at")
        .eq("submitted_by", user.id)
        .eq("country_code", country_code)
        .order("submitted_at", { ascending: false })
        .limit(50)
        .returns<Pick<CpiSubmissionRow, "country_code" | "period" | "status" | "submitted_at">[]>(),
    ]);

  // Collapse the 13-row-per-batch list into one row per (period, status) so
  // the user sees a clean batch-level history.
  type BatchRow = {
    period: string;
    status: CpiSubmissionStatus;
    submitted_at: string;
  };
  const seen = new Set<string>();
  const recentBatches: BatchRow[] = [];
  for (const r of mySubmissions ?? []) {
    const key = `${r.period}|${r.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recentBatches.push({
      period: r.period,
      status: r.status,
      submitted_at: r.submitted_at,
    });
    if (recentBatches.length >= 6) break;
  }
  const pendingPeriods = new Set(
    recentBatches
      .filter((b) => b.status === "pending_review" || b.status === "pending_approval")
      .map((b) => b.period),
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/contribute" className="font-semibold tracking-tight">
          ← Contribute
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{country?.name}</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          Submit CPI data
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Enter the official monthly index value for each category, copied
          directly from a publication on one of the approved source domains.
          Two reviewers from other countries must sign off before your data
          becomes live.
        </p>

        {recentBatches.length > 0 && (
          <section className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
            <h2 className="text-lg font-semibold">Your recent submissions</h2>
            <ul className="mt-3 divide-y divide-black/5 text-sm dark:divide-white/10">
              {recentBatches.map((b) => (
                <li
                  key={`${b.period}-${b.status}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div>
                    <span className="font-medium">
                      {new Date(b.period).toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>{" "}
                    <span className={statusPillClass(b.status)}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {(b.status === "pending_review" || b.status === "pending_approval") && (
                    <WithdrawPendingButton
                      country_code={country_code}
                      period={b.period}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <SubmitCpiForm
          country_code={country_code}
          country_name={country?.name ?? ""}
          categories={(categories ?? []).filter((c) => c.code === "00" || c.display_order > 0)}
          whitelist={(whitelist ?? []).map((w) => ({ domain: w.domain, description: w.description }))}
          pendingPeriods={Array.from(pendingPeriods)}
        />
      </section>
    </main>
  );
}

function statusPillClass(status: CpiSubmissionStatus): string {
  const base = "ml-2 rounded-full px-2 py-0.5 text-xs font-medium";
  switch (status) {
    case "pending_review":
    case "pending_approval":
      return `${base} bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200`;
    case "live":
      return `${base} bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200`;
    case "rejected":
      return `${base} bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200`;
    case "superseded":
      return `${base} bg-zinc-200 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300`;
  }
}
