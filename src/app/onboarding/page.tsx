import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CoicopCategory, Country, UserSpendingRow } from "@/lib/types";
import { OnboardingForm } from "./OnboardingForm";
import { signOut } from "@/app/actions/auth";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: countries }, { data: categories }, { data: profile }, { data: spending }] =
    await Promise.all([
      supabase
        .from("countries")
        .select("code, iso3, name, currency, cpi_source, is_supported, region")
        .order("region", { ascending: true })
        .order("name", { ascending: true })
        .returns<Country[]>(),
      supabase
        .from("coicop_categories")
        .select("code, name, short_name, description, display_order")
        .gt("display_order", 0)
        .order("display_order", { ascending: true })
        .returns<CoicopCategory[]>(),
      supabase
        .from("user_profiles")
        .select("country_code, display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_spending")
        .select("user_id, category_code, monthly_amount")
        .eq("user_id", user.id)
        .returns<UserSpendingRow[]>(),
    ]);

  const initialSpending: Record<string, number> = {};
  for (const row of spending ?? []) {
    initialSpending[row.category_code] = Number(row.monthly_amount);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          My Real CPI
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16 pt-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Let&apos;s set up your CPI.
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Two quick steps. Takes about 60 seconds.
        </p>

        <div className="mt-8">
          <OnboardingForm
            countries={countries ?? []}
            categories={categories ?? []}
            initialCountryCode={profile?.country_code ?? null}
            initialDisplayName={profile?.display_name ?? null}
            initialSpending={initialSpending}
          />
        </div>
      </section>
    </main>
  );
}
