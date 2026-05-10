"use client";

import { useActionState } from "react";
import {
  moderateApplication,
  type ModerateState,
} from "@/app/actions/community";

const initialState: ModerateState = null;

type Props = {
  user_id: string;
  country_code: string;
  role: "contributor" | "reviewer" | "approver" | "moderator";
  application_note: string | null;
  created_at: string;
};

export function ApplicationRow(props: Props) {
  const [state, formAction, pending] = useActionState(
    moderateApplication,
    initialState,
  );

  return (
    <tr>
      <td className="px-4 py-3 font-mono text-xs">{props.user_id.slice(0, 8)}…</td>
      <td className="px-4 py-3">{props.country_code}</td>
      <td className="px-4 py-3 capitalize">{props.role}</td>
      <td className="px-4 py-3 max-w-md truncate text-zinc-600 dark:text-zinc-300" title={props.application_note ?? ""}>
        {props.application_note || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">
        {new Date(props.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <form action={formAction} className="flex justify-end gap-2">
          <input type="hidden" name="user_id" value={props.user_id} />
          <input type="hidden" name="country_code" value={props.country_code} />
          <input type="hidden" name="role" value={props.role} />
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Reject
          </button>
        </form>
        {state?.ok === false && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </td>
    </tr>
  );
}
