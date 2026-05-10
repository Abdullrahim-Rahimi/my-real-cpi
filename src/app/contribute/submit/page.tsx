import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeContributorCountry } from "@/lib/community/roles";
import type {
  CountryContributorRow,
  SourceWhitelistRow,
} from "@/lib/community/types";
import type { CoicopCategory, Country } from "@/lib/types";
import { SubmitCpiForm } from "./SubmitCpiForm";
import { signOut } from "@/app/actions/auth";

export default async function ContributeSubmitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/contribute/submit");

  const { data: roles } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id)
    .returns<CountryContributorRow[]>();

  const country_code = activeContributorCountry(roles ?? []);
  if (!country_code) {
    redirect("/contribute?reason=not_contributor");
  }

  const [{ data: country }, { data: categories }, { data: whitelist }] =
    await Promise.all([
      supabase
        .from("countries")
        .select("code, iso3, name, currency, cpi_source, is_supported, region")
        .eq("code", country_code)
        .maybeSingle<Country>(),
      supabase
        .from("coicop_categories")
        .select("code, name, short_name, description, display_order")
        .order("display_order", { ascending: true })
        .returns<CoicopCategory[]>(),
      supabase
        .from("country_source_whitelist")
        .select("country_code, domain, description, added_by, added_at")
        .eq("country_code", country_code)
        .returns<SourceWhitelistRow[]>(),
    ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-emerald-50/60 text-zinc-900 dark:from-zinc-950 dark:to-emerald-950/30 dark:text-zinc-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/contribute" className="font-semibold tracking-tight">
          ← Contribute
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{country?.name}</span>
          <form action={signOut}>
            <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          Submit CPI data
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Enter the official monthly index value for each category, copied
          directly from a publication on one of the approved source domains.
          Two reviewers from other countries must sign off before your data
          becomes live.
        </p>

        <SubmitCpiForm
          country_code={country_code}
          country_name={country?.name ?? ""}
          categories={(categories ?? []).filter((c) => c.code === "00" || c.display_order > 0)}
          whitelist={(whitelist ?? []).map((w) => ({ domain: w.domain, description: w.description }))}
        />
      </section>
    </main>
  );
}
