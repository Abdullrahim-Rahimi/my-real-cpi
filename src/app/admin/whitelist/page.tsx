import { createClient } from "@/lib/supabase/server";
import type { Country } from "@/lib/types";
import type { SourceWhitelistRow } from "@/lib/community/types";
import { WhitelistAddForm } from "./WhitelistAddForm";
import { WhitelistRemoveButton } from "./WhitelistRemoveButton";

export default async function AdminWhitelistPage() {
  const supabase = await createClient();

  const [{ data: countries }, { data: rows }] = await Promise.all([
    supabase
      .from("countries")
      .select("code, iso3, name, currency, cpi_source, is_supported, region")
      .order("region", { ascending: true })
      .order("name", { ascending: true })
      .returns<Country[]>(),
    supabase
      .from("country_source_whitelist")
      .select("country_code, domain, description, added_by, added_at")
      .order("country_code", { ascending: true })
      .order("domain", { ascending: true })
      .returns<SourceWhitelistRow[]>(),
  ]);

  // Group whitelist rows by country.
  const byCountry = new Map<string, SourceWhitelistRow[]>();
  for (const r of rows ?? []) {
    if (!byCountry.has(r.country_code)) byCountry.set(r.country_code, []);
    byCountry.get(r.country_code)!.push(r);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Source-URL whitelist</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Per-country list of domains that contributor source URLs are matched
        against (suffix match: <code>gss.gov.gh</code> matches{" "}
        <code>data.gss.gov.gh</code> too).
      </p>

      <div className="mt-6">
        <WhitelistAddForm countries={countries ?? []} />
      </div>

      <div className="mt-10 flex flex-col gap-6">
        {(countries ?? []).map((c) => {
          const list = byCountry.get(c.code) ?? [];
          if (list.length === 0) return null;
          return (
            <section
              key={c.code}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
            >
              <h2 className="text-lg font-semibold">
                {c.name} <span className="text-sm font-normal text-zinc-500">· {c.code}</span>
              </h2>
              <ul className="mt-3 space-y-1">
                {list.map((w) => (
                  <li key={w.domain} className="flex items-center justify-between gap-3">
                    <div>
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                        {w.domain}
                      </code>
                      {w.description && (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {w.description}
                        </span>
                      )}
                    </div>
                    <WhitelistRemoveButton country_code={w.country_code} domain={w.domain} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
