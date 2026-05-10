"use client";

import { useActionState } from "react";
import {
  setNotifyPersonalCpi,
  type PreferenceState,
} from "@/app/actions/auth";

const initialState: PreferenceState = null;

export function NotifyToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(
    setNotifyPersonalCpi,
    initialState,
  );
  const enabled =
    state?.ok === true ? state.notify_personal_cpi : initialEnabled;

  return (
    <form action={formAction} className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Email me when new data lands</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Once a month — your personal CPI plus the headline, when fresh data
          for your country comes in.
        </p>
      </div>
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={enabled}
        className={
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 " +
          (enabled
            ? "bg-emerald-600"
            : "bg-zinc-300 dark:bg-zinc-700")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
            (enabled ? "translate-x-6" : "translate-x-1")
          }
        />
        <span className="sr-only">
          {enabled ? "Notifications on" : "Notifications off"}
        </span>
      </button>
      {state?.ok === false && (
        <p className="basis-full text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
