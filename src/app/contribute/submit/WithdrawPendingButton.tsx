"use client";

import { useActionState } from "react";
import {
  withdrawSubmission,
  type WithdrawState,
} from "@/app/actions/community";

const initialState: WithdrawState = null;

export function WithdrawPendingButton({
  country_code,
  period,
}: {
  country_code: string;
  period: string;
}) {
  const [state, formAction, pending] = useActionState(
    withdrawSubmission,
    initialState,
  );

  if (state?.ok) {
    return (
      <span className="text-xs text-emerald-700 dark:text-emerald-400">
        Withdrawn — you can resubmit now.
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="country_code" value={country_code} />
      <input type="hidden" name="period" value={period} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {pending ? "…" : "Withdraw"}
      </button>
      {state?.ok === false && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
