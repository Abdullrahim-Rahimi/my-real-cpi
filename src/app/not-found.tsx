import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Page not found.
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist (or your basket
          inflated it away).
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
