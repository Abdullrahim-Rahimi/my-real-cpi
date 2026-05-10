"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveOnboarding,
  type OnboardingState,
} from "@/app/actions/onboarding";
import { CountryCombobox } from "@/components/CountryCombobox";
import { formatCurrency } from "@/lib/format";
import type { CoicopCategory, Country } from "@/lib/types";

const initialState: OnboardingState = null;

type Props = {
  countries: Country[];
  categories: CoicopCategory[]; // already filtered to display_order > 0
  initialCountryCode?: string | null;
  initialDisplayName?: string | null;
  initialSpending?: Record<string, number>;
};

export function OnboardingForm({
  countries,
  categories,
  initialCountryCode,
  initialDisplayName,
  initialSpending = {},
}: Props) {
  const [state, formAction, pending] = useActionState(
    saveOnboarding,
    initialState,
  );
  const [countryCode, setCountryCode] = useState(initialCountryCode ?? "");
  const [spending, setSpending] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of categories) {
      const v = initialSpending[c.code];
      out[c.code] = v ? String(v) : "";
    }
    return out;
  });

  const country = countries.find((c) => c.code === countryCode);
  const currency = country?.currency ?? "";
  const isUnsupported = !!country && !country.is_supported;

  const total = useMemo(
    () =>
      Object.values(spending).reduce(
        (a, b) => a + (Number.parseFloat(b) || 0),
        0,
      ),
    [spending],
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Country */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">1. Where do you live?</h2>
        <CountryCombobox
          countries={countries}
          name="country_code"
          required
          value={countryCode}
          onChange={setCountryCode}
          placeholder="Search countries…"
        />
        {isUnsupported && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            <p>
              We don&apos;t have official CPI by category for{" "}
              <strong>{country?.name}</strong> yet. You can still enter your
              spending — we&apos;ll show your real CPI as soon as data lands.
            </p>
            <p className="mt-2">
              <a
                href="/contribute"
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                Help us bring {country?.name} online →
              </a>{" "}
              <span className="text-amber-800/80 dark:text-amber-200/80">
                Become a contributor: 10 min/month copying from your stat office.
              </span>
            </p>
          </div>
        )}
      </section>

      {/* Display name (optional) */}
      <section className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="display_name">
          What should we call you? <span className="text-zinc-500">(optional)</span>
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          maxLength={80}
          defaultValue={initialDisplayName ?? ""}
          placeholder="e.g. Sam"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        />
      </section>

      {/* Spending */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">2. Roughly what do you spend each month?</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use whatever currency you live in. Leave a category blank if you
            spend nothing on it. You can update these any time.
          </p>
        </div>

        <div className="grid gap-3">
          {categories.map((cat) => (
            <label
              key={cat.code}
              className="flex flex-col gap-1 rounded-xl border border-black/5 bg-white p-3 sm:flex-row sm:items-center sm:gap-4 dark:border-white/10 dark:bg-zinc-900/60"
            >
              <div className="flex-1">
                <div className="font-medium">{cat.short_name}</div>
                {cat.description && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {cat.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currency && (
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {currency}
                  </span>
                )}
                <input
                  name={`spending[${cat.code}]`}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  placeholder="0"
                  value={spending[cat.code] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    if (/^[0-9]*\.?[0-9]*$/.test(v)) {
                      setSpending((s) => ({ ...s, [cat.code]: v }));
                    }
                  }}
                  className="w-32 rounded-lg border border-black/10 bg-white px-3 py-2 text-right text-base text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </label>
          ))}
        </div>

        <div className="sticky bottom-2 flex items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Monthly total
          </span>
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(total, currency)}
          </span>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending || !countryCode || total <= 0}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Show me my real CPI"}
      </button>

      {state?.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
