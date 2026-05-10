"use client";

import { useActionState, useMemo, useState } from "react";
import {
  addWhitelistDomain,
  type WhitelistState,
} from "@/app/actions/community";
import type { Country } from "@/lib/types";

const initialState: WhitelistState = null;

export function WhitelistAddForm({ countries }: { countries: Country[] }) {
  const [state, formAction, pending] = useActionState(
    addWhitelistDomain,
    initialState,
  );
  const [country, setCountry] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");

  const grouped = useMemo(() => {
    const m = new Map<string, Country[]>();
    for (const c of countries) {
      if (!m.has(c.region)) m.set(c.region, []);
      m.get(c.region)!.push(c);
    }
    const order = ["Europe", "Americas", "Asia", "Africa", "Oceania"];
    return order.filter((r) => m.has(r)).map((r) => [r, m.get(r)!] as const);
  }, [countries]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:flex-row sm:items-end dark:border-white/10 dark:bg-zinc-900/60"
    >
      <div className="flex-1">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="country_code">
          Country
        </label>
        <select
          id="country_code"
          name="country_code"
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        >
          <option value="" disabled>
            Choose…
          </option>
          {grouped.map(([region, list]) => (
            <optgroup key={region} label={region}>
              {list.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex-[2]">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="domain">
          Domain
        </label>
        <input
          id="domain"
          name="domain"
          required
          placeholder="gss.gov.gh"
          value={domain}
          onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
          className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        />
      </div>
      <div className="flex-[2]">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="description">
          Description (optional)
        </label>
        <input
          id="description"
          name="description"
          placeholder="Ghana Statistical Service"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !country || !domain}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add domain"}
      </button>
      {state?.ok === false && (
        <p className="basis-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
