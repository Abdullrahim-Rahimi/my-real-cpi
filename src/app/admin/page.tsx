import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function count(table: string, filters: Record<string, string>) {
  const supabase = await createClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

export default async function AdminHome() {
  const [pendingApps, pendingReview, pendingApproval, liveSubmissions] = await Promise.all([
    count("country_contributors", { status: "pending" }),
    count("cpi_submissions", { status: "pending_review" }),
    count("cpi_submissions", { status: "pending_approval" }),
    count("cpi_submissions", { status: "live" }),
  ]);

  const cards = [
    {
      title: "Pending applications",
      value: pendingApps,
      href: "/admin/applications",
    },
    {
      title: "Pending review",
      value: pendingReview,
      href: "/contribute/review",
    },
    {
      title: "Pending approval",
      value: pendingApproval,
      href: "/contribute/approve",
    },
    {
      title: "Live community submissions",
      value: liveSubmissions,
      href: "/admin/members",
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/60"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.title}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
