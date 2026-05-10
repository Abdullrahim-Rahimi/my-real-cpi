// Source-URL whitelist matching.
//
// The DB stores allowed domains per country (e.g. "gss.gov.gh"). A submission's
// source_url passes the check if its hostname equals one of the allowed
// domains, OR is a subdomain of one (so "data.gss.gov.gh" matches the
// "gss.gov.gh" rule). We deliberately match by host suffix only — never path,
// query, or scheme — because state agencies reorganize their URL structure
// often but rarely change their root domain.

export function extractHostname(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Strip leading "www." so contributors don't have to whitelist both forms.
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * True iff `host` is `domain` OR a subdomain of `domain`.
 * "data.gss.gov.gh" suffix-matches "gss.gov.gh".
 * "evilgss.gov.gh" does NOT match "gss.gov.gh" (must be a true subdomain).
 */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase();
  const d = domain.toLowerCase();
  if (h === d) return true;
  return h.endsWith("." + d);
}

/**
 * True iff `url`'s hostname matches any whitelist entry for that country.
 */
export function isUrlWhitelisted(
  url: string,
  whitelistDomains: readonly string[],
): boolean {
  const host = extractHostname(url);
  if (!host) return false;
  return whitelistDomains.some((d) => hostMatchesDomain(host, d));
}
