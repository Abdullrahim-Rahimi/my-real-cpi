export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
