export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60"
            />
          ))}
        </div>
        <div className="mt-10 h-[420px] animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      </section>
    </main>
  );
}
