import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/community/roles";
import type { CountryContributorRow } from "@/lib/community/types";
import { signOut } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/admin");

  const { data: roles } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();

  if (!isModerator(roles ?? [])) redirect("/contribute?reason=not_moderator");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="font-semibold tracking-tight">
              My Real CPI · admin
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/admin/applications" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Applications
              </Link>
              <Link href="/admin/members" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Members
              </Link>
              <Link href="/admin/data" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                CPI data
              </Link>
              <Link href="/admin/whitelist" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Source whitelist
              </Link>
              <Link href="/contribute" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Contributor view
              </Link>
              <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                My dashboard
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
