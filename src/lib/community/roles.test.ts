import { describe, expect, test } from "vitest";
import {
  activeContributorCountry,
  canApproveCountry,
  canReviewCountry,
  canSubmitForCountry,
  hasActiveRole,
  isModerator,
  type RoleSnapshot,
} from "./roles";

const role = (
  country_code: string,
  role: RoleSnapshot["role"],
  status: RoleSnapshot["status"] = "active",
): RoleSnapshot => ({ country_code, role, status });

describe("hasActiveRole / isModerator", () => {
  test("matches active role only", () => {
    expect(hasActiveRole([role("US", "reviewer")], "reviewer")).toBe(true);
    expect(hasActiveRole([role("US", "reviewer", "pending")], "reviewer")).toBe(
      false,
    );
    expect(
      hasActiveRole([role("US", "reviewer", "suspended")], "reviewer"),
    ).toBe(false);
  });

  test("isModerator delegates correctly", () => {
    expect(isModerator([role("US", "moderator")])).toBe(true);
    expect(isModerator([role("US", "approver")])).toBe(false);
  });
});

describe("activeContributorCountry", () => {
  test("returns the contributor's country", () => {
    expect(
      activeContributorCountry([role("GH", "contributor"), role("US", "reviewer")]),
    ).toBe("GH");
  });

  test("returns null if not contributor", () => {
    expect(activeContributorCountry([role("US", "reviewer")])).toBeNull();
  });

  test("ignores pending or suspended contributor rows", () => {
    expect(
      activeContributorCountry([role("GH", "contributor", "pending")]),
    ).toBeNull();
  });
});

describe("canSubmitForCountry", () => {
  test("active contributor for that country = yes", () => {
    expect(canSubmitForCountry([role("GH", "contributor")], "GH")).toBe(true);
  });

  test("active contributor for different country = no", () => {
    expect(canSubmitForCountry([role("GH", "contributor")], "US")).toBe(false);
  });

  test("not a contributor at all = no", () => {
    expect(canSubmitForCountry([role("GH", "reviewer")], "GH")).toBe(false);
  });
});

describe("canReviewCountry / canApproveCountry — cross-country rule", () => {
  test("reviewer can review countries other than their contributor country", () => {
    const roles = [role("GH", "contributor"), role("US", "reviewer")];
    expect(canReviewCountry(roles, "BR")).toBe(true);
    expect(canReviewCountry(roles, "US")).toBe(true); // contributor != US, reviewer role
  });

  test("reviewer cannot review own contributor country", () => {
    const roles = [role("GH", "contributor"), role("US", "reviewer")];
    expect(canReviewCountry(roles, "GH")).toBe(false);
  });

  test("user with no reviewer role can't review at all", () => {
    expect(canReviewCountry([role("GH", "contributor")], "BR")).toBe(false);
  });

  test("moderators can review any country except their contributor country", () => {
    const roles = [role("GH", "contributor"), role("US", "moderator")];
    expect(canReviewCountry(roles, "BR")).toBe(true);
    expect(canReviewCountry(roles, "GH")).toBe(false);
  });

  test("moderator with no contributor role can review anything", () => {
    expect(canReviewCountry([role("US", "moderator")], "GH")).toBe(true);
  });

  test("approver gate behaves the same way", () => {
    const roles = [role("GH", "contributor"), role("BR", "approver")];
    expect(canApproveCountry(roles, "BR")).toBe(true);
    expect(canApproveCountry(roles, "GH")).toBe(false);
    expect(canApproveCountry([role("BR", "approver")], "BR")).toBe(true);
    expect(canApproveCountry([role("US", "reviewer")], "BR")).toBe(false);
  });
});
