import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeContributorCountry, hasActiveRole } from "@/lib/community/roles";
import type {
  CountryContributorRow,
  CpiSubmissionRow,
} from "@/lib/community/types";
import { ReviewBatch } from "./ReviewBatch";
import { signOut } from "@/app/actions/auth";

type BatchKey = string; // `${country_code}|${period}|${submitted_by}`

type Batch = {
  key: BatchKey;
  country_code: string;
  country_name?: string;
  period: string;
  submitted_by: string;
  source_url: string;
  submitted_at: string;
  rows: CpiSubmissionRow[];
};

export default async function ReviewQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/contribute/review");

  const { data: roles } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();
  const myRoles = roles ?? [];

  const isReviewer =
    hasActiveRole(myRoles, "reviewer") || hasActiveRole(myRoles, "moderator");
  if (!isReviewer) redirect("/contribute?reason=not_reviewer");

  const myCountry = activeContributorCountry(myRoles);

  // Pull pending submissions, excluding any from the reviewer's contributor country.
  // We pull a sliding window of up to 100 rows; in practice the queue is small.
  let q = supabase
    .from("cpi_submissions")
    .select(
      "id, country_code, category_code, period, index_value, source_url, submitted_by, submitter_country, submitted_at, status",
    )
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (myCountry) q = q.neq("country_code", myCountry);
  const { data: rows } = await q.returns<CpiSubmissionRow[]>();

  // Group by (country, period, submitter) to form batches.
  const batches = new Map<string, Batch>();
  for (const r of rows ?? []) {
    const key = `${r.country_code}|${r.period}|${r.submitted_by}`;
    if (!batches.has(key)) {
      batches.set(key, {
        key,
        country_code: r.country_code,
        period: r.period,
        submitted_by: r.submitted_by,
        source_url: r.source_url,
        submitted_at: r.submitted_at,
        rows: [],
      });
    }
    batches.get(key)!.rows.push(r);
  }

  // Hydrate country names for display.
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
          <span>Reviewer</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {myCountry
            ? `Submissions from any country except ${myCountry} (your contributor country).`
            : `All pending submissions. Verify each batch's numbers against the linked source URL.`}
        </p>

        {batchList.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
            <p className="text-zinc-600 dark:text-zinc-400">
              Nothing in the queue right now. 🎉
            </p>
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
              <ReviewBatch
                key={b.key}
                country_code={b.country_code}
                country_name={b.country_name}
                period={b.period}
                submitted_by={b.submitted_by}
                submitted_at={b.submitted_at}
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
