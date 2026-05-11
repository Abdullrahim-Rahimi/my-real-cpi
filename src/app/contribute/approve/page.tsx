import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeContributorCountry, hasActiveRole } from "@/lib/community/roles";
import type {
  CountryContributorRow,
  CpiSubmissionRow,
} from "@/lib/community/types";
import { ApproveBatch } from "./ApproveBatch";
import { signOut } from "@/app/actions/auth";

type Batch = {
  key: string;
  country_code: string;
  country_name?: string;
  period: string;
  submitted_by: string;
  submitter_country: string;
  reviewer_id: string;
  source_url: string;
  reviewed_at: string;
  reviewer_note: string | null;
  rows: CpiSubmissionRow[];
};

export default async function ApproveQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/contribute/approve");

  const { data: roles } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();
  const myRoles = roles ?? [];

  const isApprover =
    hasActiveRole(myRoles, "approver") || hasActiveRole(myRoles, "moderator");
  if (!isApprover) redirect("/contribute?reason=not_approver");

  const myCountry = activeContributorCountry(myRoles);

  let q = supabase
    .from("cpi_submissions")
    .select(
      "id, country_code, category_code, period, index_value, source_url, submitted_by, submitter_country, submitted_at, reviewer_id, reviewed_at, reviewer_note, status",
    )
    .eq("status", "pending_approval")
    .neq("reviewer_id", user.id) // approver != reviewer; the DB also enforces this
    .order("reviewed_at", { ascending: true })
    .limit(200);
  if (myCountry) q = q.neq("country_code", myCountry);
  const { data: rows } = await q.returns<CpiSubmissionRow[]>();

  // Same "explain why the queue looks empty" diagnostic as the reviewer page.
  let excludedCount = 0;
  if ((rows ?? []).length === 0 && myCountry) {
    const { count } = await supabase
      .from("cpi_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .eq("country_code", myCountry);
    excludedCount = count ?? 0;
  }

  const batches = new Map<string, Batch>();
  for (const r of rows ?? []) {
    const key = `${r.country_code}|${r.period}|${r.submitted_by}`;
    if (!batches.has(key)) {
      batches.set(key, {
        key,
        country_code: r.country_code,
        period: r.period,
        submitted_by: r.submitted_by,
        submitter_country: r.submitter_country,
        reviewer_id: r.reviewer_id ?? "",
        source_url: r.source_url,
        reviewed_at: r.reviewed_at ?? "",
        reviewer_note: r.reviewer_note,
        rows: [],
      });
    }
    batches.get(key)!.rows.push(r);
  }

  const codes = Array.from(new Set(Array.from(batches.values()).map((b) => b.country_code)));
  if (codes.length > 0) {
    const { data: countriesData } = await supabase
      .from("countries")
      .select("code, name")
      .in("code", codes);
    const m = new Map((countriesData ?? []).map((c) => [c.code as string, c.name as string]));
    for (const b of batches.values()) b.country_name = m.get(b.country_code);
  }

  const batchList = Array.from(batches.values());

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <Link href="/contribute" className="font-semibold tracking-tight">
          ← Contribute
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Approver</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">Approval queue</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Final sign-off. The submitter and reviewer are both excluded — your
          approval makes the data live on the dashboard.
        </p>

        {batchList.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
            {excludedCount > 0 ? (
              <>
                <p className="text-zinc-700 dark:text-zinc-300">
                  Nothing for{" "}
                  <span className="font-medium">you</span> to approve right now.
                </p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  There are {excludedCount}{" "}
                  {excludedCount === 1 ? "submission" : "submissions"} ready
                  for approval, but they&apos;re all for{" "}
                  <strong>{myCountry}</strong> — your own contributor country.
                  An approver from another country has to sign them off.
                </p>
              </>
            ) : (
              <p className="text-zinc-600 dark:text-zinc-400">
                Nothing waiting on you. 🎉
              </p>
            )}
            <div className="mt-4 flex justify-center gap-4 text-sm">
              <Link
                href="/contribute"
                className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
              >
                Back to Contribute
              </Link>
              <Link
                href="/dashboard"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Open dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {batchList.map((b) => (
              <ApproveBatch
                key={b.key}
                country_code={b.country_code}
                country_name={b.country_name}
                period={b.period}
                submitted_by={b.submitted_by}
                reviewed_at={b.reviewed_at}
                reviewer_note={b.reviewer_note}
                source_url={b.source_url}
                rows={b.rows
                  .slice()
                  .sort((a, c) => a.category_code.localeCompare(c.category_code))}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
