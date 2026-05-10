"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const EmailSchema = z.string().trim().toLowerCase().email();

export type SignInState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel deployment URL is set automatically.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  // emailRedirectTo becomes `{{ .RedirectTo }}` in the email template, which
  // we use as the post-confirm `next` param. /auth/confirm then re-routes
  // based on onboarding state, so /dashboard is just the logical default.
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${siteUrl()}/dashboard`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, email: parsed.data };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Send the user back to the marketing page after signing out.
  redirect("/");
}
