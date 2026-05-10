"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, type SignInState } from "@/app/actions/auth";

const initialState: SignInState = null;

type SignInFormProps = {
  /** Optional post-auth redirect (e.g. "/contribute"). Must start with "/". */
  next?: string;
  /** Override the submit button label (e.g. "Sign in to contribute"). */
  cta?: string;
};

export function SignInForm({ next, cta }: SignInFormProps = {}) {
  // Bumping `key` forces useActionState to reset to the input view when the
  // user clicks "try a different email" after a successful send.
  const [formKey, setFormKey] = useState(0);
  return (
    <SignInFormInner
      key={formKey}
      next={next}
      cta={cta}
      onReset={() => setFormKey((k) => k + 1)}
    />
  );
}

function SignInFormInner({
  next,
  cta,
  onReset,
}: SignInFormProps & { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 px-5 py-6 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">Check your inbox.</p>
        <p className="mt-1 text-sm opacity-90">
          We sent a sign-in link to <span className="font-medium">{state.email}</span>.
          The link expires in 1 hour.
        </p>
        <p className="mt-3 text-xs opacity-80">
          Didn&apos;t arrive? Check spam, or{" "}
          <button
            type="button"
            onClick={onReset}
            className="underline underline-offset-2 hover:opacity-100"
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      />
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : cta ?? "Get my real CPI"}
      </button>
      {state?.ok === false && (
        <p className="basis-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
