"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SpendingEntry = z.coerce.number().nonnegative().finite();

const Payload = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  display_name: z.string().trim().max(80).optional().or(z.literal("")),
  spending: z.record(z.string().regex(/^[0-9]{2}$/), SpendingEntry),
});

export type OnboardingState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function saveOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Pull spending fields out of the form (they come in as spending[01], spending[02], …)
  const spending: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^spending\[(\d{2})\]$/);
    if (m) spending[m[1]] = v;
  }

  const parsed = Payload.safeParse({
    country_code: formData.get("country_code"),
    display_name: formData.get("display_name") ?? "",
    spending,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please fill out every field with valid numbers." };
  }
  const { country_code, display_name, spending: spendMap } = parsed.data;

  const total = Object.values(spendMap).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { ok: false, error: "Total spending must be greater than zero." };
  }

  // Look up the country's currency so we can stamp it on the profile.
  const { data: country, error: countryErr } = await supabase
    .from("countries")
    .select("currency, is_supported")
    .eq("code", country_code)
    .maybeSingle();
  if (countryErr || !country) {
    return { ok: false, error: "Country not found." };
  }

  // Upsert profile.
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      country_code,
      display_name: display_name || null,
      currency: country.currency,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (profileErr) return { ok: false, error: profileErr.message };

  // Upsert spending rows. Skip zeros — we don't need them in the breakdown.
  const rows = Object.entries(spendMap)
    .filter(([, amount]) => amount > 0)
    .map(([category_code, amount]) => ({
      user_id: user.id,
      category_code,
      monthly_amount: amount,
    }));
  if (rows.length > 0) {
    const { error: spendErr } = await supabase
      .from("user_spending")
      .upsert(rows, { onConflict: "user_id,category_code" });
    if (spendErr) return { ok: false, error: spendErr.message };
  }

  // Clear out any old categories the user zeroed out on a re-edit.
  const keptCodes = rows.map((r) => r.category_code);
  if (keptCodes.length > 0) {
    await supabase
      .from("user_spending")
      .delete()
      .eq("user_id", user.id)
      .not("category_code", "in", `(${keptCodes.map((c) => `"${c}"`).join(",")})`);
  } else {
    await supabase.from("user_spending").delete().eq("user_id", user.id);
  }

  redirect("/dashboard");
}
