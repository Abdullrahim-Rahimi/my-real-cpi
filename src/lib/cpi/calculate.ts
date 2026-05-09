import type { CoicopCategory } from "@/lib/types";

export type CategoryBreakdown = {
  code: string;
  short_name: string;
  display_order: number;
  user_amount: number;
  user_weight: number; // share of covered spending (renormalized)
  yoy_pct: number;
  contribution_pct: number; // user_weight * yoy_pct
};

export type PersonalCpi = {
  personal_yoy_pct: number;
  official_yoy_pct: number | null;
  coverage_pct: number; // % of user spending where category-level CPI is available
  breakdown: CategoryBreakdown[];
  period: string | null; // ISO date of the CPI period these numbers reflect
};

type CpiLookup = Map<string, { yoy_pct: number | null; period: string }>;

/**
 * Compute personal CPI = Σ(weight_i × yoy_i) across categories that have BOTH
 * user spending AND a YoY number for that period.
 *
 * Categories with spending but no CPI data are excluded from the sum, and
 * weights are renormalized over the covered subset. We surface coverage_pct
 * so the UI can be honest about partial data.
 */
export function computePersonalCpi({
  categories,
  spending,
  cpiByCategory,
}: {
  categories: CoicopCategory[]; // display_order > 0 (the 12 divisions)
  spending: Map<string, number>; // category_code -> monthly amount
  cpiByCategory: CpiLookup; // category_code -> { yoy_pct, period }
}): PersonalCpi {
  const total = Array.from(spending.values()).reduce((a, b) => a + b, 0);

  let coveredTotal = 0;
  const rawRows: {
    cat: CoicopCategory;
    amount: number;
    yoy: number;
    period: string;
  }[] = [];

  for (const cat of categories) {
    const amount = spending.get(cat.code) ?? 0;
    if (amount <= 0) continue;
    const cpi = cpiByCategory.get(cat.code);
    if (!cpi || cpi.yoy_pct == null) continue;
    rawRows.push({ cat, amount, yoy: cpi.yoy_pct, period: cpi.period });
    coveredTotal += amount;
  }

  const breakdown: CategoryBreakdown[] = rawRows
    .map(({ cat, amount, yoy }) => {
      const weight = coveredTotal > 0 ? amount / coveredTotal : 0;
      return {
        code: cat.code,
        short_name: cat.short_name,
        display_order: cat.display_order,
        user_amount: amount,
        user_weight: weight,
        yoy_pct: yoy,
        contribution_pct: weight * yoy,
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  const personal_yoy_pct = breakdown.reduce(
    (sum, r) => sum + r.contribution_pct,
    0,
  );

  const official = cpiByCategory.get("00");

  return {
    personal_yoy_pct,
    official_yoy_pct: official?.yoy_pct ?? null,
    coverage_pct: total > 0 ? coveredTotal / total : 0,
    breakdown,
    period: rawRows[0]?.period ?? official?.period ?? null,
  };
}
