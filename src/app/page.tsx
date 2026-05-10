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

// Restrict deep-link `next=` to absolute paths starting with "/" so the
// landing page can't be turned into an open redirect.
const SAFE_NEXT = /^\/[A-Za-z0-9/_\-?&=.]*$/;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = rawNext && SAFE_NEXT.test(rawNext) ? rawNext : undefined;

  // If already signed in, jump straight in. Honor `?next=` if present.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (next) redirect(next);
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(profile?.onboarded_at ? "/dashboard" : "/onboarding");
  }

  const isContributeFlow = next === "/contribute";

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <nav className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="#how-it-works"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            How it works
          </Link>
          <Link
            href="#contribute"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Contribute
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pb-20 sm:pt-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-100/60 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-200">
          {isContributeFlow
            ? "Become a community contributor."
            : "The headline CPI isn’t your CPI."}
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {isContributeFlow ? (
            <>
              Help bring{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                real CPI
              </span>{" "}
              to your country.
            </>
          ) : (
            <>
              See how inflation is{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                really
              </span>{" "}
              affecting you.
            </>
          )}
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg text-zinc-600 dark:text-zinc-300">
          {isContributeFlow
            ? "Sign in with your email and apply to be a contributor for your country. We’ll review your application; once approved, you can submit official CPI data each month for everyone in your country to use."
            : "Official CPI uses an average national basket. Your spending isn’t average. Tell us what you actually spend on, and we’ll compute your personal inflation rate from the same trusted data the central banks watch."}
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
          <SignInForm
            next={next}
            cta={isContributeFlow ? "Sign in to contribute" : undefined}
          />
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

      <section
        id="contribute"
        className="mx-auto max-w-5xl px-5 pb-20"
      >
        <div className="rounded-2xl border border-emerald-600/20 bg-emerald-50/70 p-6 sm:p-10 dark:border-emerald-500/30 dark:bg-emerald-950/30">
          <div className="grid gap-6 sm:grid-cols-[1.6fr_1fr] sm:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Open data, kept fresh by humans
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Don&apos;t see your country covered?
              </h2>
              <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                We auto-ingest official CPI for ~33 countries. For everywhere
                else, we rely on a community pipeline: a contributor in-country
                submits the official monthly numbers, and two reviewers from
                other countries verify against the source before the data goes
                live.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-3">
                <li>
                  <span className="font-medium">1. Apply.</span> Pick your
                  country and tell us briefly who you are.
                </li>
                <li>
                  <span className="font-medium">2. Submit.</span> 10 minutes a
                  month, copying from your stat office.
                </li>
                <li>
                  <span className="font-medium">3. Sign off.</span> Reviewers
                  in other countries verify and publish.
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/?next=/contribute#how-it-works"
                className="rounded-xl bg-emerald-600 px-5 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Apply as a contributor
              </Link>
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                Sign in with email · approval is manual and fast
              </p>
            </div>
          </div>
        </div>
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
