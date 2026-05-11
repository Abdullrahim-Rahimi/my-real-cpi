"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  updateMember,
  type UpdateMemberState,
} from "@/app/actions/community";
import { CountryCombobox } from "@/components/CountryCombobox";
import type {
  CommunityRole,
  CommunityStatus,
} from "@/lib/community/types";
import type { Country } from "@/lib/types";

const initialState: UpdateMemberState = null;

type Props = {
  user_id: string;
  old_country_code: string;
  old_role: CommunityRole;
  old_status: CommunityStatus;
  countries: Country[];
};

export function EditMemberForm({
  user_id,
  old_country_code,
  old_role,
  old_status,
  countries,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMember,
    initialState,
  );
  const [country, setCountry] = useState(old_country_code);
  const [role, setRole] = useState<CommunityRole>(old_role);
  const [status, setStatus] = useState<CommunityStatus>(old_status);

  const isDirty =
    country !== old_country_code || role !== old_role || status !== old_status;
  const keyChanged = country !== old_country_code || role !== old_role;

  // After a successful save, send them back to the members list.
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => router.push("/admin/members"), 600);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
    >
      <input type="hidden" name="user_id" value={user_id} />
      <input type="hidden" name="old_country_code" value={old_country_code} />
      <input type="hidden" name="old_role" value={old_role} />

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Country
        </label>
        <div className="mt-1">
          <CountryCombobox
            countries={countries}
            name="new_country_code"
            required
            value={country}
            onChange={setCountry}
            placeholder="Search countries…"
            showComingSoon={false}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="new_role"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Role
          </label>
          <select
            id="new_role"
            name="new_role"
            value={role}
            onChange={(e) => setRole(e.target.value as CommunityRole)}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          >
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="approver">Approver</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="new_status"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Status
          </label>
          <select
            id="new_status"
            name="new_status"
            value={status}
            onChange={(e) => setStatus(e.target.value as CommunityStatus)}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {keyChanged && (
        <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          You&apos;re changing the country or role. The record will be moved
          atomically — the old key (
          <code>{old_country_code}/{old_role}</code>) is replaced with the
          new one (<code>{country}/{role}</code>).
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !isDirty}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a
          href="/admin/members"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </a>
        {state?.ok === true && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Saved. Redirecting…
          </p>
        )}
        {state?.ok === false && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
