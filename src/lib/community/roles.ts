// Pure helpers for reasoning about a user's community roles. The Supabase
// RLS layer enforces these at the DB level, but we duplicate them in app code
// for fast UI decisions (e.g. "should I show the review queue link?").

import type {
  CommunityRole,
  CommunityStatus,
  CountryContributorRow,
} from "./types";

// Sybil-resistance gate: minimum account age (in days) before a user can
// apply for the reviewer or approver roles via self-application.
export const MIN_ACCOUNT_AGE_DAYS = 30;

export type RoleSnapshot = Pick<
  CountryContributorRow,
  "country_code" | "role" | "status"
>;

/** True iff the user has any active role of the given kind. */
export function hasActiveRole(
  roles: readonly RoleSnapshot[],
  role: CommunityRole,
): boolean {
  return roles.some((r) => r.role === role && r.status === "active");
}

/** Returns the country code the user is an active contributor for, if any. */
export function activeContributorCountry(
  roles: readonly RoleSnapshot[],
): string | null {
  return (
    roles.find((r) => r.role === "contributor" && r.status === "active")
      ?.country_code ?? null
  );
}

/** True iff the user is an active moderator (no country gating). */
export function isModerator(roles: readonly RoleSnapshot[]): boolean {
  return hasActiveRole(roles, "moderator");
}

/**
 * Cross-country rule: a user can review a submission for `country_code` iff
 *   1. they hold an active reviewer role (moderators count), AND
 *   2. they are NOT an active contributor for that same country.
 */
export function canReviewCountry(
  roles: readonly RoleSnapshot[],
  country_code: string,
): boolean {
  const hasReviewerRole =
    hasActiveRole(roles, "reviewer") || hasActiveRole(roles, "moderator");
  if (!hasReviewerRole) return false;
  return activeContributorCountry(roles) !== country_code;
}

/** Same rule for the approver gate. */
export function canApproveCountry(
  roles: readonly RoleSnapshot[],
  country_code: string,
): boolean {
  const hasApproverRole =
    hasActiveRole(roles, "approver") || hasActiveRole(roles, "moderator");
  if (!hasApproverRole) return false;
  return activeContributorCountry(roles) !== country_code;
}

/** True iff the user can submit data for `country_code`. */
export function canSubmitForCountry(
  roles: readonly RoleSnapshot[],
  country_code: string,
): boolean {
  return roles.some(
    (r) =>
      r.role === "contributor" &&
      r.status === "active" &&
      r.country_code === country_code,
  );
}

/** Pretty-prints a role status for the UI. */
export function statusLabel(s: CommunityStatus): string {
  switch (s) {
    case "pending":
      return "Pending review";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
  }
}
