"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  submitCpiBatch,
  type SubmitState,
} from "@/app/actions/community";
import type { CoicopCategory } from "@/lib/types";

const initialState: SubmitState = null;

type Props = {
  country_code: string;
  country_name: string;
  categories: CoicopCategory[]; // includes '00' (headline) + 1..12
  whitelist: { domain: string; description: string | null }[];
  /** Periods the user already has in-flight (pending review/approval). */
  pendingPeriods?: string[];
};

function thisMonthFirstDay(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function SubmitCpiForm({
  country_code,
  country_name,
  categories,
  whitelist,
  pendingPeriods = [],
}: Props) {
  const [state, formAction, pending] = useActionState(
    submitCpiBatch,
    initialState,
  );
  const [period, setPeriod] = useState(thisMonthFirstDay());
  const [sourceUrl, setSourceUrl] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of categories) o[c.code] = "";
    return o;
  });

  const allFilled = useMemo(
    () => categories.every((c) => values[c.code] && Number.isFinite(Number.parseFloat(values[c.code]))),
    [categories, values],
  );
  const pendingSet = useMemo(() => new Set(pendingPeriods), [pendingPeriods]);
  const isPeriodPending = pendingSet.has(period);
  const canSubmit = period && sourceUrl && allFilled && !isPeriodPending;

  if (state?.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-300/40 bg-emerald-50 p-6 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Submitted {state.submitted_count} categories.</p>
        <p className="mt-1 text-sm opacity-90">
          Your batch is in the review queue. You&apos;ll see it move to live on
          the dashboard once a reviewer and an approver from other countries
          sign off.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Open dashboard
          </Link>
          <Link
            href="/contribute"
            className="rounded-xl border border-emerald-700/30 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-zinc-900 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          >
            Back to Contribute
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="country_code" value={country_code} />
      <input type="hidden" name="period" value={period} />

      {whitelist.length > 0 && (
        <section className="rounded-xl border border-black/5 bg-white p-4 text-sm dark:border-white/10 dark:bg-zinc-900/60">
          <h3 className="font-semibold">Recommended sources for {country_name}</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Reviewers will be looking for an official source — these are the
            ones moderators have flagged as authoritative. You can submit a
            URL from anywhere, but submissions are easier to verify when
            they&apos;re on this list.
          </p>
          <ul className="mt-3 space-y-1">
            {whitelist.map((w) => (
              <li key={w.domain} className="flex items-center justify-between gap-3">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                  {w.domain}
                </code>
                {w.description && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{w.description}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Period + source URL */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="period">
            Reporting period
          </label>
          <input
            id="period"
            type="month"
            required
            value={period.slice(0, 7)}
            onChange={(e) =>
              e.target.value
                ? setPeriod(e.target.value + "-01")
                : setPeriod(thisMonthFirstDay())
            }
            className={
              "rounded-xl border bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:bg-zinc-900 dark:text-white " +
              (isPeriodPending
                ? "border-amber-400 ring-1 ring-amber-200 dark:border-amber-500/60"
                : "border-black/10 dark:border-white/10")
            }
          />
          {isPeriodPending && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You already have a pending submission for this period. Withdraw
              it above to submit a correction.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="source_url">
            Source URL
          </label>
          <input
            id="source_url"
            name="source_url"
            type="url"
            required
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://gss.gov.gh/cpi-may-2026.pdf"
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        </div>
      </section>

      {/* 13 category inputs */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Index values (base 100)</h3>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Enter the index level for each COICOP category, exactly as published.
          Code <code>00</code> is the all-items headline.
        </p>
        <div className="grid gap-3">
          {categories.map((cat) => (
            <label
              key={cat.code}
              className="flex flex-col gap-1 rounded-xl border border-black/5 bg-white p-3 sm:flex-row sm:items-center sm:gap-4 dark:border-white/10 dark:bg-zinc-900/60"
            >
              <div className="flex-1">
                <div className="font-medium">
                  <code className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                    {cat.code}
                  </code>
                  {cat.short_name}
                </div>
                {cat.description && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {cat.description}
                  </div>
                )}
              </div>
              <input
                name={`entry[${cat.code}]`}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                placeholder="e.g. 132.4"
                value={values[cat.code] ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  if (/^[0-9]*\.?[0-9]*$/.test(v)) {
                    setValues((s) => ({ ...s, [cat.code]: v }));
                  }
                }}
                className="w-32 rounded-lg border border-black/10 bg-white px-3 py-2 text-right text-base text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={!canSubmit || pending}
        className="self-start rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit batch"}
      </button>

      {state?.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
