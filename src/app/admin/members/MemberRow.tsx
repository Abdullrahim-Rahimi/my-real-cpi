"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  moderateApplication,
  type ModerateState,
} from "@/app/actions/community";
import type { CommunityRole, CommunityStatus } from "@/lib/community/types";

const initialState: ModerateState = null;

const STATUS_STYLES: Record<CommunityStatus, string> = {
  pending:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  active:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  suspended:
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300",
};

type Props = {
  user_id: string;
  email: string | null;
  country_code: string;
  country_name: string;
  role: CommunityRole;
  status: CommunityStatus;
  created_at: string;
};

export function MemberRow(props: Props) {
  const [state, formAction, pending] = useActionState(
    moderateApplication,
    initialState,
  );

  function actionButton(
    decision: "approve" | "suspend" | "reject",
    label: string,
    variant: "primary" | "ghost" | "danger",
  ) {
    const classes =
      variant === "primary"
        ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        : variant === "danger"
          ? "rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 dark:border-red-500/40 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
          : "rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
    return (
      <button
        type="submit"
        name="decision"
        value={decision}
        disabled={pending}
        className={classes + " disabled:opacity-60"}
      >
        {label}
      </button>
    );
  }

  return (
    <tr>
      <td className="px-4 py-3">
        {props.email ? (
          <a
            href={`mailto:${props.email}`}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {props.email}
          </a>
        ) : (
          <span className="font-mono text-xs text-zinc-500">
            {props.user_id.slice(0, 8)}…
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="font-medium">{props.country_name}</span>{" "}
        <span className="text-xs text-zinc-500">{props.country_code}</span>
      </td>
      <td className="px-4 py-3 capitalize">{props.role}</td>
      <td className="px-4 py-3">
        <span
          className={
            "inline-block rounded-full px-2 py-0.5 text-xs font-medium " +
            STATUS_STYLES[props.status]
          }
        >
          {props.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">
        {new Date(props.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          <form action={formAction} className="flex gap-2">
            <input type="hidden" name="user_id" value={props.user_id} />
            <input type="hidden" name="country_code" value={props.country_code} />
            <input type="hidden" name="role" value={props.role} />
            {props.status === "pending" && (
              <>
                {actionButton("approve", "Approve", "primary")}
                {actionButton("reject", "Reject", "danger")}
              </>
            )}
            {props.status === "active" && (
              <>
                {actionButton("suspend", "Suspend", "ghost")}
                {actionButton("reject", "Remove", "danger")}
              </>
            )}
            {props.status === "suspended" && (
              <>
                {actionButton("approve", "Reactivate", "primary")}
                {actionButton("reject", "Remove", "danger")}
              </>
            )}
          </form>
          <Link
            href={`/admin/members/edit?user_id=${encodeURIComponent(props.user_id)}&country_code=${encodeURIComponent(props.country_code)}&role=${encodeURIComponent(props.role)}`}
            className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        {state?.ok === false && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </td>
    </tr>
  );
}
