// Per-user personal-CPI email notifications.
//
// The flow:
//   1. notifyPersonalCpiForCountry(country_code, period) is called after a
//      country gets new monthly data — either by the cron ingestion or by a
//      community submission going live.
//   2. We pull all onboarded users in that country who haven't been
//      notified for that period yet AND who haven't opted out
//      (notify_personal_cpi = true).
//   3. For each, compute personal CPI using their spending and the country's
//      latest cpi_index rows.
//   4. Send the email and write a row to personal_cpi_notifications so we
//      never resend the same period to the same user.
//
// Concurrency: bounded fan-out (PARALLEL = 5) to keep us under Vercel's
// function-duration limit and Mailgun's rate budget.

import { createServiceClient } from "@/lib/supabase/server";
import { computePersonalCpi } from "@/lib/cpi/calculate";
import { sendEmail, isEmailConfigured } from "./mailgun";
import { personalCpiUpdate } from "./templates";
import { unsubscribeUrl } from "./unsubscribe";
import type { CoicopCategory, CpiIndexRow, UserSpendingRow } from "@/lib/types";

const PARALLEL = 5;

type Result = {
  country_code: string;
  period: string;
  attempted: number;
  sent: number;
  skipped_opted_out: number;
  skipped_no_data: number;
  skipped_already_sent: number;
  errors: string[];
};

export async function notifyPersonalCpiForCountry(args: {
  country_code: string;
  period: string;
}): Promise<Result> {
  const r: Result = {
    country_code: args.country_code,
    period: args.period,
    attempted: 0,
    sent: 0,
    skipped_opted_out: 0,
    skipped_no_data: 0,
    skipped_already_sent: 0,
    errors: [],
  };
  if (!isEmailConfigured()) {
    r.errors.push("not_configured");
    return r;
  }

  const supabase = createServiceClient();

  // Country metadata for the friendly name in the email.
  const { data: countryRow } = await supabase
    .from("countries")
    .select("code, name, currency")
    .eq("code", args.country_code)
    .maybeSingle();
  if (!countryRow) {
    r.errors.push("country_not_found");
    return r;
  }
  const countryName: string = (countryRow.name as string) ?? args.country_code;

  // Users in this country who have completed onboarding.
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, country_code, currency, notify_personal_cpi, onboarded_at")
    .eq("country_code", args.country_code)
    .not("onboarded_at", "is", null);

  if (!profiles || profiles.length === 0) return r;

  // Pre-fetch shared data (categories + cpi_index for this country) once.
  const [{ data: categoriesAll }, { data: cpiRows }] = await Promise.all([
    supabase
      .from("coicop_categories")
      .select("code, name, short_name, description, display_order")
      .returns<CoicopCategory[]>(),
    supabase
      .from("cpi_index")
      .select("country_code, category_code, period, index_value, yoy_pct, source, fetched_at")
      .eq("country_code", args.country_code)
      .order("period", { ascending: false })
      .returns<CpiIndexRow[]>(),
  ]);

  const divisions = (categoriesAll ?? []).filter((c) => c.display_order > 0);

  // Latest YoY per category for this country.
  const latestByCat = new Map<string, { yoy_pct: number | null; period: string }>();
  for (const row of cpiRows ?? []) {
    if (!latestByCat.has(row.category_code)) {
      latestByCat.set(row.category_code, {
        yoy_pct: row.yoy_pct == null ? null : Number(row.yoy_pct),
        period: row.period,
      });
    }
  }

  // Confirm we actually have data for the requested period — otherwise the
  // upstream caller is mistaken and we shouldn't email anything.
  const headlineForPeriod = (cpiRows ?? []).find(
    (r) => r.category_code === "00" && r.period === args.period,
  );
  if (!headlineForPeriod) {
    r.errors.push("no_cpi_for_period");
    return r;
  }

  // Existing notification log — to skip any user we already emailed this period.
  const { data: existingLogs } = await supabase
    .from("personal_cpi_notifications")
    .select("user_id")
    .eq("country_code", args.country_code)
    .eq("period", args.period);
  const alreadyNotified = new Set<string>(
    (existingLogs ?? []).map((l) => l.user_id as string),
  );

  // All spending rows for these users in one query.
  const userIds = profiles.map((p) => p.user_id as string);
  const { data: spendingRows } = await supabase
    .from("user_spending")
    .select("user_id, category_code, monthly_amount")
    .in("user_id", userIds)
    .returns<UserSpendingRow[]>();

  const spendingByUser = new Map<string, Map<string, number>>();
  for (const row of spendingRows ?? []) {
    if (!spendingByUser.has(row.user_id)) {
      spendingByUser.set(row.user_id, new Map());
    }
    spendingByUser.get(row.user_id)!.set(row.category_code, Number(row.monthly_amount));
  }

  // Process users in bounded chunks.
  type Profile = (typeof profiles)[number];
  const queue: Profile[] = [...profiles];
  async function worker() {
    while (queue.length > 0) {
      const p = queue.shift();
      if (!p) return;
      r.attempted++;

      if (p.notify_personal_cpi === false) {
        r.skipped_opted_out++;
        continue;
      }
      if (alreadyNotified.has(p.user_id as string)) {
        r.skipped_already_sent++;
        continue;
      }

      const spending = spendingByUser.get(p.user_id as string) ?? new Map();
      const computed = computePersonalCpi({
        categories: divisions,
        spending,
        cpiByCategory: latestByCat,
      });
      if (computed.breakdown.length === 0) {
        r.skipped_no_data++;
        continue;
      }

      // Look up the recipient's email via auth admin API.
      const { data: userRes } = await supabase.auth.admin.getUserById(
        p.user_id as string,
      );
      const email = userRes?.user?.email;
      if (!email) {
        r.errors.push(`no_email_for_${p.user_id}`);
        continue;
      }

      // Build top movers (categories that contributed most to personal CPI).
      const topMovers = computed.breakdown
        .slice()
        .sort((a, b) => Math.abs(b.contribution_pct) - Math.abs(a.contribution_pct))
        .slice(0, 3)
        .map((b) => ({
          short_name: b.short_name,
          yoy_pct: b.yoy_pct,
          weight: b.user_weight,
        }));

      const tmpl = personalCpiUpdate({
        country_name: countryName,
        period: args.period,
        personal_yoy_pct: computed.personal_yoy_pct,
        official_yoy_pct: computed.official_yoy_pct,
        coverage_pct: computed.coverage_pct,
        top_movers: topMovers,
        unsubscribe_url: unsubscribeUrl(p.user_id as string),
      });

      const send = await sendEmail({ to: email, ...tmpl });
      if (send.ok) {
        r.sent++;
        // Record so we never re-send for this period.
        await supabase.from("personal_cpi_notifications").insert({
          user_id: p.user_id,
          country_code: args.country_code,
          period: args.period,
        });
      } else {
        r.errors.push(`send_${p.user_id}_${send.reason}`);
      }
    }
  }

  await Promise.all(Array.from({ length: PARALLEL }, () => worker()));
  return r;
}
