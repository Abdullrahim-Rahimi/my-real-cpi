// Locale-aware number formatting helpers. We don't have a perfect locale per
// country (some countries use multiple), so we use a reasonable default per
// currency. Falls back to en-US otherwise.

const CURRENCY_LOCALE: Record<string, string> = {
  EUR: "de-DE",
  GBP: "en-GB",
  USD: "en-US",
  CHF: "de-CH",
  NOK: "nb-NO",
  ISK: "is-IS",
  TRY: "tr-TR",
  SEK: "sv-SE",
  DKK: "da-DK",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  HUF: "hu-HU",
  RON: "ro-RO",
  BGN: "bg-BG",
};

export function formatCurrency(
  amount: number,
  currency: string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!currency) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, ...options }).format(amount);
  }
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      ...options,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatPeriod(
  d: string | null | undefined,
  locale: string = "en-US",
): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}
