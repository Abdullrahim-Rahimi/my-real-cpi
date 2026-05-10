"use client";

import { useActionState, useMemo, useState } from "react";
import {
  applyAsContributor,
  type ApplyState,
} from "@/app/actions/community";
import type { Country } from "@/lib/types";

const initialState: ApplyState = null;

export function ApplyContributorForm({ countries }: { countries: Country[] }) {
  const [state, formAction, pending] = useActionState(
    applyAsContributor,
    initialState,
  );
  const [countryCode, setCountryCode] = useState("");

  // Group by region for the dropdown — same UX as onboarding.
  const byRegion = useMemo(() => {
    const groups = new Map<string, Country[]>();
    for (const c of countries) {
      if (!groups.has(c.region)) groups.set(c.region, []);
      groups.get(c.region)!.push(c);
    }
    const order = ["Europe", "Americas", "Asia", "Africa", "Oceania"];
    return order
      .filter((r) => groups.has(r))
      .map((r) => [r, groups.get(r)!] as const);
  }, [countries]);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Application submitted.</p>
        <p className="mt-1 text-sm opacity-90">
          A moderator will review it shortly. You&apos;ll be able to submit
          once approved.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="country_code">
        Country you want to contribute for
      </label>
      <select
        id="country_code"
        name="country_code"
        required
        value={countryCode}
        onChange={(e) => setCountryCode(e.target.value)}
        className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      >
        <option value="" disabled>
          Select a country…
        </option>
        {byRegion.map(([region, list]) => (
          <optgroup key={region} label={region}>
            {list.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.is_supported ? " — auto-ingested" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <label className="mt-2 text-sm font-medium" htmlFor="application_note">
        Why you?{" "}
        <span className="font-normal text-zinc-500">(optional, helps moderators)</span>
      </label>
      <textarea
        id="application_note"
        name="application_note"
        rows={3}
        maxLength={500}
        placeholder="e.g. I'm based in Accra; I read GSS releases as part of my work."
        className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      />

      <button
        type="submit"
        disabled={pending || !countryCode}
        className="mt-2 self-start rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Apply"}
      </button>

      {state?.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
