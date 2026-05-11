"use client";

import { useActionState } from "react";
import {
  setMyRoleStatus,
  type SelfStatusState,
} from "@/app/actions/community";

const initialState: SelfStatusState = null;

type Props = {
  role: "contributor" | "reviewer" | "approver";
  country_code: string;
  currentStatus: "active" | "suspended";
};

export function RoleStatusToggle(props: Props) {
  const [state, formAction, pending] = useActionState(
    setMyRoleStatus,
    initialState,
  );

  const next: "active" | "suspended" =
    props.currentStatus === "active" ? "suspended" : "active";
  const label =
    next === "suspended"
      ? "Step down"
      : "Reactivate";

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="role" value={props.role} />
      <input type="hidden" name="country_code" value={props.country_code} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        className={
          "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 " +
          (next === "suspended"
            ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            : "bg-emerald-600 text-white hover:bg-emerald-500")
        }
      >
        {pending ? "…" : label}
      </button>
      {state?.ok === false && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
