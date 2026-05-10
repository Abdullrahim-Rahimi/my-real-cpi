import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "@/components/SignInForm";

function prettifyAuthError(raw: string): string {
  switch (raw) {
    case "missing_code":
    case "missing_token":
      return "The sign-in link looks incomplete. Try requesting a new one.";
    case "Email link is invalid or has expired":
    case "Token has expired or is invalid":
      return "That sign-in link has expired or already been used. Request a new one.";
    default:
      return raw.replace(/_/g, " ");
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // If already signed in, jump straight in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(profile?.onboarded_at ? "/dashboard" : "/onboarding");
  }

  // Surface auth-callback errors so users get a real message instead of just
  // landing back on the email form with no explanation.
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <Link
          href="#how-it-works"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          How it works
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pb-20 sm:pt-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-100/60 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-200">
          The headline CPI isn&apos;t your CPI.
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          See how inflation is{" "}
          <span className="text-emerald-700 dark:text-emerald-400">really</span>{" "}
          affecting you.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg text-zinc-600 dark:text-zinc-300">
          Official CPI uses an average national basket. Your spending isn&apos;t
          average. Tell us what you actually spend on, and we&apos;ll compute
          your personal inflation rate from the same trusted data the central
          banks watch.
        </p>

        <div className="mt-8">
          {error && (
            <div className="mb-4 rounded-xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-100">
              <p className="font-medium">We couldn&apos;t sign you in.</p>
              <p className="mt-1 text-red-800/90 dark:text-red-200/90">
                {prettifyAuthError(error)}
              </p>
            </div>
          )}
          <SignInForm />
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            We&apos;ll email you a one-tap sign-in link. No password.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto grid max-w-5xl gap-6 px-5 pb-20 sm:grid-cols-3"
      >
        {[
          {
            step: "1",
            title: "Pick your country",
            body: "We pull the latest official CPI by spending category for ~60 countries (OECD, EU, US). More coming.",
          },
          {
            step: "2",
            title: "Enter your spending",
            body: "Roughly what you spend each month on food, housing, transport, etc. Takes 60 seconds.",
          },
          {
            step: "3",
            title: "See your real CPI",
            body: "Your personal inflation rate vs the headline number, with a per-category breakdown.",
          },
        ].map((s) => (
          <div
            key={s.step}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
              {s.step}
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {s.body}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <p>© {new Date().getFullYear()} My Real CPI</p>
          <p>
            Data: OECD, Eurostat, US BLS. Personal CPI is informational, not
            financial advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
