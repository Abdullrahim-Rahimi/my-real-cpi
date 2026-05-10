"use client";

import { useActionState } from "react";
import {
  removeWhitelistDomain,
  type WhitelistState,
} from "@/app/actions/community";

const initialState: WhitelistState = null;

export function WhitelistRemoveButton({
  country_code,
  domain,
}: {
  country_code: string;
  domain: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeWhitelistDomain,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="country_code" value={country_code} />
      <input type="hidden" name="domain" value={domain} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
      >
        {pending ? "…" : "Remove"}
      </button>
      {state?.ok === false && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}
