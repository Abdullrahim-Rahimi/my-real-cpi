"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook for any client-side error reporting later (e.g. Sentry).
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          We hit an unexpected error.
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Try again in a moment. If the problem keeps happening, your data is
          safe — sign in again later and pick up where you left off.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Try again
        </button>
        {error.digest && (
          <p className="mt-6 text-xs text-zinc-400">
            Error reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
