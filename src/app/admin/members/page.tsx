import { createServiceClient } from "@/lib/supabase/server";
import type {
  CommunityRole,
  CommunityStatus,
  CountryContributorRow,
} from "@/lib/community/types";
import type { Country } from "@/lib/types";
import { AddMemberForm } from "./AddMemberForm";
import { MemberRow } from "./MemberRow";

type FilterParams = {
  status?: CommunityStatus | "all";
  role?: CommunityRole | "all";
  country?: string;
};

/** Approximate cap on roster rows we render at once. */
const PAGE_LIMIT = 200;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const { status, role, country } = await searchParams;
  const statusFilter = (status ?? "all") as CommunityStatus | "all";
  const roleFilter = (role ?? "all") as CommunityRole | "all";

  // Use the service-role client because we need to read emails from auth.users
  // (RLS hides those from regular clients). Page is gated by isModerator()
  // in the parent /admin layout.
  const supabase = createServiceClient();

  let query = supabase
    .from("country_contributors")
    .select(
      "user_id, country_code, role, status, application_note, approved_by, approved_at, suspended_at, created_at",
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(PAGE_LIMIT);
  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (roleFilter !== "all") query = query.eq("role", roleFilter);
  if (country) query = query.eq("country_code", country);

  const { data: rows, error } = await query.returns<CountryContributorRow[]>();
  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="mt-3 text-red-600">{error.message}</p>
      </main>
    );
  }

  // Resolve emails. The auth admin API only exposes one user at a time; we
  // batch with bounded concurrency.
  const uniqueIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const emails = new Map<string, string>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      const { data } = await supabase.auth.admin.getUserById(id);
      if (data?.user?.email) emails.set(id, data.user.email);
    }),
  );

  // Country names for display.
  const codes = Array.from(new Set((rows ?? []).map((r) => r.country_code)));
  const countryNames = new Map<string, string>();
  if (codes.length > 0) {
    const { data: cs } = await supabase
      .from("countries")
      .select("code, name")
      .in("code", codes);
    for (const c of cs ?? []) countryNames.set(c.code as string, c.name as string);
  }

  // Distinct country list for the filter dropdown.
  const { data: allCountries } = await supabase
    .from("countries")
    .select("code, name")
    .order("name", { ascending: true });

  // Full country rows for the AddMemberForm's combobox.
  const { data: countriesFull } = await supabase
    .from("countries")
    .select("code, iso3, name, currency, cpi_source, is_supported, region")
    .order("region", { ascending: true })
    .order("name", { ascending: true })
    .returns<Country[]>();

  // Counts by status for the filter chips.
  const counts = { all: 0, pending: 0, active: 0, suspended: 0 };
  const { data: countRows } = await supabase
    .from("country_contributors")
    .select("status");
  for (const r of countRows ?? []) {
    counts.all++;
    const s = r.status as CommunityStatus;
    if (s in counts) counts[s]++;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Every contributor, reviewer, approver, and moderator across the platform.
        Use the filters to narrow down. Email is shown so you can reach out
        if needed.
      </p>

      <div className="mt-6">
        <AddMemberForm countries={countriesFull ?? []} />
      </div>

      <Filters
        currentStatus={statusFilter}
        currentRole={roleFilter}
        currentCountry={country ?? ""}
        countries={(allCountries ?? []).map((c) => ({
          code: c.code as string,
          name: c.name as string,
        }))}
        counts={counts}
      />

      {(!rows || rows.length === 0) ? (
        <div className="mt-10 rounded-2xl border border-black/5 bg-white p-6 text-center text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
          No members match those filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {rows.map((r) => (
                <MemberRow
                  key={`${r.user_id}-${r.country_code}-${r.role}`}
                  user_id={r.user_id}
                  email={emails.get(r.user_id) ?? null}
                  country_code={r.country_code}
                  country_name={countryNames.get(r.country_code) ?? r.country_code}
                  role={r.role}
                  status={r.status}
                  created_at={r.created_at}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length >= PAGE_LIMIT && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Showing the first {PAGE_LIMIT} rows. Narrow the filters above to see more.
        </p>
      )}
    </main>
  );
}

function Filters(props: {
  currentStatus: CommunityStatus | "all";
  currentRole: CommunityRole | "all";
  currentCountry: string;
  countries: { code: string; name: string }[];
  counts: { all: number; pending: number; active: number; suspended: number };
}) {
  function link(over: {
    status?: string;
    role?: string;
    country?: string;
  }): string {
    const params = new URLSearchParams();
    const status = over.status ?? props.currentStatus;
    const role = over.role ?? props.currentRole;
    const country = over.country ?? props.currentCountry;
    if (status !== "all") params.set("status", status);
    if (role !== "all") params.set("role", role);
    if (country) params.set("country", country);
    const q = params.toString();
    return q ? `/admin/members?${q}` : "/admin/members";
  }

  const statuses: Array<CommunityStatus | "all"> = [
    "all",
    "pending",
    "active",
    "suspended",
  ];
  const roles: Array<CommunityRole | "all"> = [
    "all",
    "contributor",
    "reviewer",
    "approver",
    "moderator",
  ];

  return (
    <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Status
        </span>
        {statuses.map((s) => (
          <a
            key={s}
            href={link({ status: s })}
            className={
              "rounded-full px-3 py-1 text-xs font-medium " +
              (s === props.currentStatus
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
            }
          >
            {s}
            {s !== "all" && (
              <span className="ml-1 opacity-70">
                · {props.counts[s as keyof typeof props.counts]}
              </span>
            )}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Role
        </span>
        {roles.map((r) => (
          <a
            key={r}
            href={link({ role: r })}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize " +
              (r === props.currentRole
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
            }
          >
            {r}
          </a>
        ))}
      </div>
      <form className="flex items-center gap-2">
        <label
          htmlFor="country-filter"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
        >
          Country
        </label>
        {props.currentStatus !== "all" && (
          <input type="hidden" name="status" value={props.currentStatus} />
        )}
        {props.currentRole !== "all" && (
          <input type="hidden" name="role" value={props.currentRole} />
        )}
        <select
          id="country-filter"
          name="country"
          defaultValue={props.currentCountry}
          className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <option value="">All</option>
          {props.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
