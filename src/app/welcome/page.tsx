import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  activeContributorCountry,
  hasActiveRole,
} from "@/lib/community/roles";
import type { CountryContributorRow } from "@/lib/community/types";
import { signOut } from "@/app/actions/auth";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fetch role rows + profile + (for any country codes that show up) their names.
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase
      .from("country_contributors")
      .select(
        "user_id, country_code, role, status, application_note, approved_by, approved_at, suspended_at, created_at",
      )
      .eq("user_id", user.id)
      .returns<CountryContributorRow[]>(),
    supabase
      .from("user_profiles")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const roles = (roleRows ?? []).filter((r) => r.status === "active");

  // Returning end users (already onboarded, no community roles) shouldn't see
  // the welcome page on every sign-in — they'd hit it on each magic-link
  // click after we made /welcome the default confirm destination. Send them
  // straight to their dashboard. Community members still land here on
  // repeat visits because /welcome surfaces their queues/admin links.
  if (profile?.onboarded_at && roles.length === 0) {
    redirect("/dashboard");
  }
  const countryCodes = Array.from(new Set(roles.map((r) => r.country_code)));
  const countryNames = new Map<string, string>();
  if (countryCodes.length > 0) {
    const { data: cs } = await supabase
      .from("countries")
      .select("code, name")
      .in("code", countryCodes);
    for (const c of cs ?? []) countryNames.set(c.code as string, c.name as string);
  }

  const isContributor = hasActiveRole(roles, "contributor");
  const isReviewer = hasActiveRole(roles, "reviewer") || hasActiveRole(roles, "moderator");
  const isApprover = hasActiveRole(roles, "approver") || hasActiveRole(roles, "moderator");
  const isModerator = hasActiveRole(roles, "moderator");
  const isOnboarded = profile?.onboarded_at != null;
  const contributorCountry = activeContributorCountry(roles);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16 pt-2">
        {/* Confirmation hero */}
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            You&apos;re in.
          </h1>
          <p className="mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
            Your email is confirmed and you&apos;re signed in as{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {user.email}
            </span>
            .
          </p>
        </div>

        {/* Granted roles */}
        {roles.length > 0 && (
          <section className="mt-10 rounded-2xl border border-emerald-600/20 bg-emerald-50/70 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              You&apos;ve been added to the community
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
              {roles.map((r) => (
                <li key={`${r.country_code}-${r.role}`}>
                  <span className="font-medium capitalize">{r.role}</span>
                  {r.role === "contributor" &&
                    ` for ${countryNames.get(r.country_code) ?? r.country_code}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Next steps */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            What you can do next
          </h2>
          <div className="mt-3 grid gap-3">
            {isContributor && (
              <NextCard
                href="/contribute/submit"
                title={`Submit CPI data${contributorCountry ? ` for ${countryNames.get(contributorCountry) ?? contributorCountry}` : ""}`}
                body="Enter the official monthly index values for each category. Takes about 10 minutes per period."
                emphasis
              />
            )}
            {isReviewer && (
              <NextCard
                href="/contribute/review"
                title="Open the review queue"
                body={
                  isModerator
                    ? "As a moderator, you can review any batch except those for your own contributor country."
                    : "Verify pending submissions against their source URL."
                }
                emphasis={!isContributor}
              />
            )}
            {isApprover && (
              <NextCard
                href="/contribute/approve"
                title="Open the approval queue"
                body="Final sign-off on submissions that have already been reviewed."
              />
            )}
            {isModerator && (
              <NextCard
                href="/admin"
                title="Admin panel"
                body="Manage members, approve applications, edit the source-URL whitelist."
              />
            )}

            {/* Personal CPI is available to everyone — always offer this */}
            <NextCard
              href={isOnboarded ? "/dashboard" : "/onboarding"}
              title={
                isOnboarded
                  ? "Open your personal dashboard"
                  : "Set up your personal dashboard"
              }
              body={
                isOnboarded
                  ? "Your personal CPI vs the official headline."
                  : "60 seconds to enter your country and monthly spending — then you'll see your personal inflation rate."
              }
              emphasis={roles.length === 0}
            />
          </div>
        </section>

        {/* Read more for invited users */}
        {roles.length > 0 && (
          <p className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
            New to the project?{" "}
            <Link
              href="/"
              className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
            >
              See how the data and community pipeline work
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  );
}

function NextCard({
  href,
  title,
  body,
  emphasis = false,
}: {
  href: string;
  title: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-2xl border p-4 transition " +
        (emphasis
          ? "border-emerald-600/30 bg-white shadow-sm hover:border-emerald-600/50 dark:border-emerald-500/40 dark:bg-zinc-900/60"
          : "border-black/5 bg-white shadow-sm hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/60")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {body}
          </div>
        </div>
        <span aria-hidden className="text-emerald-700 dark:text-emerald-400">
          →
        </span>
      </div>
    </Link>
  );
}
