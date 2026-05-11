import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  activeContributorCountry,
  hasActiveRole,
  statusLabel,
} from "@/lib/community/roles";
import type { CountryContributorRow } from "@/lib/community/types";
import type { Country } from "@/lib/types";
import { ApplyContributorForm } from "./ApplyContributorForm";
import { ApplyRoleForm } from "./ApplyRoleForm";
import { RoleStatusToggle } from "./RoleStatusToggle";
import { signOut } from "@/app/actions/auth";

// Friendly explanations when a user lands here after a permission redirect.
const REASON_MESSAGES: Record<string, string> = {
  not_moderator:
    "You don't have moderator access. The admin tools are only available to active moderators.",
  not_contributor:
    "You're not an active contributor yet. Apply for the country you live in below — once a moderator approves, you can submit data.",
  not_reviewer:
    "You don't have reviewer permissions yet. You'll need to be an active contributor for at least 30 days before applying.",
  not_approver:
    "You don't have approver permissions yet. You'll need to be an active contributor for at least 30 days before applying.",
};

export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/contribute");

  const { reason } = await searchParams;
  const reasonMessage = reason ? REASON_MESSAGES[reason] : undefined;

  const [{ data: roleRows }, { data: countries }] = await Promise.all([
    supabase
      .from("country_contributors")
      .select(
        "user_id, country_code, role, status, application_note, approved_by, approved_at, suspended_at, created_at",
      )
      .eq("user_id", user.id)
      .returns<CountryContributorRow[]>(),
    supabase
      .from("countries")
      .select("code, iso3, name, currency, cpi_source, is_supported, region")
      .order("region", { ascending: true })
      .order("name", { ascending: true })
      .returns<Country[]>(),
  ]);

  const roles = roleRows ?? [];
  const country = activeContributorCountry(roles);
  const isMod = hasActiveRole(roles, "moderator");
  const hasReviewer = hasActiveRole(roles, "reviewer") || isMod;
  const hasApprover = hasActiveRole(roles, "approver") || isMod;
  const hasContributor = !!country;
  const pendingContributor = roles.find(
    (r) => r.role === "contributor" && r.status === "pending",
  );

  // Account age days for the role-application gate copy.
  const accountAgeDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Dashboard
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

      <section className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Contribute to My Real CPI
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          For countries we can&apos;t auto-ingest, the community keeps the data
          fresh through a three-step process: a contributor in-country submits;
          a reviewer in another country checks against the official source; an
          approver in a third country signs off.
        </p>

        {/* Permission-redirect banner */}
        {reasonMessage && (
          <div className="mt-6 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            {reasonMessage}
          </div>
        )}

        {/* Your roles */}
        {roles.length > 0 && (
          <section className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
            <h2 className="text-lg font-semibold">Your roles</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {roles.map((r) => (
                <li
                  key={`${r.country_code}-${r.role}`}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <span>
                    <span className="font-medium capitalize">{r.role}</span>
                    {r.role === "contributor" ? ` · ${r.country_code}` : ""}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        r.status === "active"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : r.status === "pending"
                            ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      {statusLabel(r.status)}
                    </span>
                    {r.role !== "moderator" && (r.status === "active" || r.status === "suspended") && (
                      <RoleStatusToggle
                        role={r.role}
                        country_code={r.country_code}
                        currentStatus={r.status}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Step down to pause your role — you can reactivate any time. To
              fully delete a role, ask a moderator.
            </p>
          </section>
        )}

        {/* Quick links */}
        {(hasContributor || hasReviewer || hasApprover || isMod) && (
          <nav className="mt-6 grid gap-3 sm:grid-cols-2">
            {hasContributor && (
              <Link
                href="/contribute/submit"
                className="rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 transition hover:border-emerald-600/40 dark:border-emerald-500/30 dark:bg-emerald-950/30"
              >
                <div className="font-semibold">Submit CPI data</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Enter monthly index values for {country}.
                </div>
              </Link>
            )}
            {hasReviewer && (
              <Link
                href="/contribute/review"
                className="rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/60"
              >
                <div className="font-semibold">Review queue</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Verify pending submissions against their source.
                </div>
              </Link>
            )}
            {hasApprover && (
              <Link
                href="/contribute/approve"
                className="rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/60"
              >
                <div className="font-semibold">Approval queue</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Final sign-off on reviewed submissions.
                </div>
              </Link>
            )}
            {isMod && (
              <Link
                href="/admin"
                className="rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/60"
              >
                <div className="font-semibold">Admin</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Approve applications, manage whitelist, etc.
                </div>
              </Link>
            )}
          </nav>
        )}

        {/* Apply as contributor */}
        {!hasContributor && !pendingContributor && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Apply as a contributor</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              You can be a contributor for one country — the one whose CPI
              releases you can read directly from the official statistics
              office.
            </p>
            <div className="mt-4">
              <ApplyContributorForm countries={countries ?? []} />
            </div>
          </section>
        )}

        {pendingContributor && (
          <section className="mt-8 rounded-2xl border border-amber-300/40 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-950/30">
            <h2 className="text-lg font-semibold">Application pending</h2>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
              Your application to be a contributor for {pendingContributor.country_code}{" "}
              is queued for moderator review. We&apos;ll email you when it&apos;s decided.
            </p>
          </section>
        )}

        {/* Apply for reviewer/approver */}
        {hasContributor && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Apply for reviewer / approver role</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Reviewer and approver roles let you sign off on submissions from
              countries other than your own. Account must be at least 30 days
              old (yours: {accountAgeDays}).
            </p>
            <div className="mt-4">
              <ApplyRoleForm
                disabled={accountAgeDays < 30}
                hasReviewer={hasActiveRole(roles, "reviewer") || roles.some((r) => r.role === "reviewer" && r.status === "pending")}
                hasApprover={hasActiveRole(roles, "approver") || roles.some((r) => r.role === "approver" && r.status === "pending")}
              />
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
