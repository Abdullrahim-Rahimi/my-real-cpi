"use client";

import { useActionState } from "react";
import { applyForRole, type RoleApplyState } from "@/app/actions/community";

const initialState: RoleApplyState = null;

type Props = {
  disabled: boolean;
  hasReviewer: boolean;
  hasApprover: boolean;
};

export function ApplyRoleForm({ disabled, hasReviewer, hasApprover }: Props) {
  const [state, formAction, pending] = useActionState(applyForRole, initialState);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Role application submitted.</p>
        <p className="mt-1 text-sm opacity-90">A moderator will review it.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {(["reviewer", "approver"] as const).map((role) => {
        const already = role === "reviewer" ? hasReviewer : hasApprover;
        return (
          <form key={role} action={formAction}>
            <input type="hidden" name="role" value={role} />
            <button
              type="submit"
              disabled={disabled || pending || already}
              title={
                disabled
                  ? "Account must be at least 30 days old"
                  : already
                    ? "You already hold or have applied for this role"
                    : ""
              }
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            >
              {already
                ? `Already a ${role}`
                : pending
                  ? "…"
                  : `Apply as ${role}`}
            </button>
          </form>
        );
      })}
      {state?.ok === false && (
        <p className="basis-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}
