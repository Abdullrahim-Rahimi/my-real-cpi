import { createClient } from "@/lib/supabase/server";
import type { CountryContributorRow } from "@/lib/community/types";
import { ApplicationRow } from "./ApplicationRow";

export default async function AdminApplicationsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("country_contributors")
    .select(
      "user_id, country_code, role, status, application_note, approved_by, approved_at, suspended_at, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<CountryContributorRow[]>();

  // Fetch emails for the displayed users via the auth admin API would require
  // service-role; for the moderator UI we just show user_id (UUID). If the
  // moderator wants an email they can look it up in the Supabase dashboard.
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pending contributor / reviewer / approver applications.
      </p>

      {(!rows || rows.length === 0) ? (
        <div className="mt-10 rounded-2xl border border-black/5 bg-white p-6 text-center text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
          Nothing pending.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {rows.map((r) => (
                <ApplicationRow
                  key={`${r.user_id}-${r.country_code}-${r.role}`}
                  user_id={r.user_id}
                  country_code={r.country_code}
                  role={r.role}
                  application_note={r.application_note}
                  created_at={r.created_at}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
