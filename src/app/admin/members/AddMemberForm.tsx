"use client";

import { useActionState, useState } from "react";
import { addMember, type AddMemberState } from "@/app/actions/community";
import { CountryCombobox } from "@/components/CountryCombobox";
import type { Country } from "@/lib/types";

const initialState: AddMemberState = null;

export function AddMemberForm({ countries }: { countries: Country[] }) {
  const [state, formAction, pending] = useActionState(addMember, initialState);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState<"contributor" | "reviewer" | "approver" | "moderator">(
    "contributor",
  );

  return (
    <details className="rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
      <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4">
        <span className="font-semibold">Add a member directly</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Skips the application phase. Existing users get the role
          immediately; new emails are invited via magic link.
        </span>
      </summary>
      <form
        action={formAction}
        className="grid gap-4 border-t border-black/5 p-5 sm:grid-cols-2 dark:border-white/10"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="add-member-email"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Email
          </label>
          <input
            id="add-member-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="add-member-country"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Country
          </label>
          <div className="mt-1">
            <CountryCombobox
              countries={countries}
              name="country_code"
              required
              value={country}
              onChange={setCountry}
              placeholder="Search countries…"
              showComingSoon={false}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            For contributors, this is the country they&apos;ll submit data
            for. For reviewers / approvers / moderators it&apos;s decorative
            (cross-country rule still applies).
          </p>
        </div>
        <div>
          <label
            htmlFor="add-member-role"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Role
          </label>
          <select
            id="add-member-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          >
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="approver">Approver</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !email || !country}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add member"}
          </button>
          {state?.ok === true && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {state.invited
                ? `Invited ${state.email} — magic-link sign-in email sent.`
                : `Added ${state.email} — role granted.`}
            </p>
          )}
          {state?.ok === false && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
