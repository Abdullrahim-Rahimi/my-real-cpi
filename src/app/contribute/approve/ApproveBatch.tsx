"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  approveBatch,
  type BatchActionState,
} from "@/app/actions/community";
import type { CpiSubmissionRow } from "@/lib/community/types";

const initialState: BatchActionState = null;

type Props = {
  country_code: string;
  country_name?: string;
  period: string;
  submitted_by: string;
  reviewed_at: string;
  reviewer_note: string | null;
  source_url: string;
  rows: CpiSubmissionRow[];
  /** Map of COICOP code → friendly short name. */
  categoryNames: Record<string, string>;
};

export function ApproveBatch(props: Props) {
  const [state, formAction, pending] = useActionState(approveBatch, initialState);
  const [note, setNote] = useState("");

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p>Decision recorded. The data is now live on the dashboard (or rejected).</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href="/contribute/approve"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Refresh queue
          </Link>
          <Link
            href="/contribute"
            className="opacity-80 hover:opacity-100"
          >
            Back to Contribute
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold">
            {props.country_name ?? props.country_code} ·{" "}
            {new Date(props.period).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Reviewed {new Date(props.reviewed_at).toLocaleString()} ·{" "}
            <a
              href={props.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
            >
              source ↗
            </a>
          </p>
          {props.reviewer_note && (
            <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
              Reviewer note: {props.reviewer_note}
            </p>
          )}
        </div>
      </header>

      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">Index value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {props.rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2">
                <span className="font-mono text-xs text-zinc-500">{r.category_code}</span>
                <span className="ml-2">
                  {props.categoryNames[r.category_code] ?? "—"}
                </span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {Number(r.index_value).toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={formAction} className="flex flex-col gap-3 border-t border-black/5 px-5 py-4 dark:border-white/10">
        <input type="hidden" name="country_code" value={props.country_code} />
        <input type="hidden" name="period" value={props.period} />
        <input type="hidden" name="submitted_by" value={props.submitted_by} />

        <textarea
          name="note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: note for the audit trail"
          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        />

        <div className="flex gap-3">
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={pending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {pending ? "…" : "Approve and publish"}
          </button>
          <button
            type="submit"
            name="action"
            value="reject"
            disabled={pending}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Reject
          </button>
        </div>

        {state?.ok === false && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </form>
    </article>
  );
}
