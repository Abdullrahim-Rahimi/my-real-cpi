import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  CommunityRole,
  CountryContributorRow,
} from "@/lib/community/types";
import type { Country } from "@/lib/types";
import { EditMemberForm } from "./EditMemberForm";

const VALID_ROLES = new Set<CommunityRole>([
  "contributor",
  "reviewer",
  "approver",
  "moderator",
]);

export default async function AdminEditMemberPage({
  searchParams,
}: {
  searchParams: Promise<{
    user_id?: string;
    country_code?: string;
    role?: string;
  }>;
}) {
  const sp = await searchParams;
  if (!sp.user_id || !sp.country_code || !sp.role) {
    redirect("/admin/members");
  }
  if (!VALID_ROLES.has(sp.role as CommunityRole)) {
    redirect("/admin/members");
  }

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("country_contributors")
    .select(
      "user_id, country_code, role, status, application_note, approved_by, approved_at, suspended_at, created_at",
    )
    .eq("user_id", sp.user_id)
    .eq("country_code", sp.country_code)
    .eq("role", sp.role)
    .maybeSingle<CountryContributorRow>();
  if (error || !row) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link
          href="/admin/members"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Members
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Edit member</h1>
        <p className="mt-3 text-red-600">
          {error ? error.message : "Member not found."}
        </p>
      </main>
    );
  }

  // Country list for the combobox.
  const { data: countries } = await supabase
    .from("countries")
    .select("code, iso3, name, currency, cpi_source, is_supported, region")
    .order("region", { ascending: true })
    .order("name", { ascending: true })
    .returns<Country[]>();

  // Look up the member's email so the admin can see who they're editing.
  const { data: userRes } = await supabase.auth.admin.getUserById(row.user_id);
  const email = userRes?.user?.email ?? null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/members"
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Members
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Edit member</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Changing the country or role will move this user&apos;s record to the
        new combination atomically. Changing status only is a regular update.
      </p>

      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">User</dt>
          <dd className="font-medium">
            {email ?? (
              <span className="font-mono text-xs">{row.user_id}</span>
            )}
          </dd>
          <dt className="text-zinc-500">Joined</dt>
          <dd>{new Date(row.created_at).toLocaleDateString()}</dd>
          {row.application_note && (
            <>
              <dt className="text-zinc-500">Note</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{row.application_note}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-6">
        <EditMemberForm
          user_id={row.user_id}
          old_country_code={row.country_code}
          old_role={row.role}
          old_status={row.status}
          countries={countries ?? []}
        />
      </div>
    </main>
  );
}
