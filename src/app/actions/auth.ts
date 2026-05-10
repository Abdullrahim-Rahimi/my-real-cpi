"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const EmailSchema = z.string().trim().toLowerCase().email();
// `next` lets a marketing CTA (e.g. "Become a contributor") deep-link a new
// signup directly to its destination after the magic-link round-trip.
// Restrict to absolute paths starting with "/" to prevent open-redirects.
const NextSchema = z
  .string()
  .regex(/^\/[A-Za-z0-9/_\-?&=.]*$/)
  .max(200)
  .optional()
  .or(z.literal(""));

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
  const parsedEmail = EmailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const parsedNext = NextSchema.safeParse(formData.get("next") ?? "");
  const next = parsedNext.success ? parsedNext.data || "" : "";

  // emailRedirectTo becomes `{{ .RedirectTo }}` in the email template (i.e.
  // the `next` param /auth/confirm reads after verifying). If the caller
  // passed a `next` (e.g. /contribute), preserve it across the round-trip.
  const redirect = next
    ? `${siteUrl()}${next}`
    : `${siteUrl()}/dashboard`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsedEmail.data,
    options: { emailRedirectTo: redirect },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, email: parsedEmail.data };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Send the user back to the marketing page after signing out.
  redirect("/");
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------
export type PreferenceState =
  | { ok: true; notify_personal_cpi: boolean }
  | { ok: false; error: string }
  | null;

export async function setNotifyPersonalCpi(
  _prev: PreferenceState,
  formData: FormData,
): Promise<PreferenceState> {
  const enabled = formData.get("enabled") === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("user_profiles")
    .update({ notify_personal_cpi: enabled })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true, notify_personal_cpi: enabled };
}
