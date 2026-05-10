"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isUrlWhitelisted } from "@/lib/community/whitelist";
import { verifyCaptchaIfConfigured } from "@/lib/community/captcha";
import {
  activeContributorCountry,
  canApproveCountry,
  canReviewCountry,
  MIN_ACCOUNT_AGE_DAYS,
} from "@/lib/community/roles";
import type { RoleSnapshot } from "@/lib/community/roles";

// ===========================================================================
// Helpers
// ===========================================================================

async function loadMyRoles(): Promise<{
  user_id: string;
  email: string | null;
  account_age_days: number;
  roles: RoleSnapshot[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("country_contributors")
    .select("country_code, role, status")
    .eq("user_id", user.id);

  // Account age (days since auth.users.created_at). Used for sybil-resistance
  // gates on reviewer/approver self-applications.
  const created = new Date(user.created_at);
  const account_age_days = Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)),
  );

  return {
    user_id: user.id,
    email: user.email ?? null,
    account_age_days,
    roles: (rows ?? []) as RoleSnapshot[],
  };
}

// ===========================================================================
// applyAsContributor
// ===========================================================================
const ApplyInput = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  application_note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ApplyState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function applyAsContributor(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const parsed = ApplyInput.safeParse({
    country_code: formData.get("country_code"),
    application_note: formData.get("application_note") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid country or note." };
  }

  const supabase = await createClient();
  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };

  // Block users who already hold a contributor role for any country.
  if (activeContributorCountry(me.roles) != null) {
    return { ok: false, error: "You already have an active contributor role for another country." };
  }

  const { error } = await supabase.from("country_contributors").insert({
    user_id: me.user_id,
    country_code: parsed.data.country_code,
    role: "contributor",
    status: "pending",
    application_note: parsed.data.application_note || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contribute");
  return { ok: true };
}

// ===========================================================================
// applyForReviewerOrApprover
// Self-applications. Blocked unless the account is at least
// MIN_ACCOUNT_AGE_DAYS old AND the user is already an active contributor
// (so we know which country to exclude them from).
// ===========================================================================
const ROLE_APP_INPUT = z.object({
  role: z.enum(["reviewer", "approver"]),
});

export type RoleApplyState = { ok: true } | { ok: false; error: string } | null;

export async function applyForRole(
  _prev: RoleApplyState,
  formData: FormData,
): Promise<RoleApplyState> {
  const parsed = ROLE_APP_INPUT.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: "Invalid role." };

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };

  const country = activeContributorCountry(me.roles);
  if (!country) {
    return {
      ok: false,
      error:
        "You need to be an active contributor for at least one country before applying for review/approve roles.",
    };
  }
  if (me.account_age_days < MIN_ACCOUNT_AGE_DAYS) {
    return {
      ok: false,
      error: `Accounts must be at least ${MIN_ACCOUNT_AGE_DAYS} days old to apply for review/approve roles. Yours is ${me.account_age_days}.`,
    };
  }

  // hCaptcha gate — passes through unless HCAPTCHA_SECRET is configured.
  const captchaResult = await verifyCaptchaIfConfigured(
    formData.get("captcha_token") as string | null,
  );
  if (!captchaResult.ok) {
    return { ok: false, error: captchaResult.reason };
  }

  const supabase = await createClient();
  // We pin the role to the user's contributor country only as a placeholder
  // for the country_code FK; the cross-country logic is in the trigger and
  // in canReviewCountry/canApproveCountry, not in this row's country_code.
  const { error } = await supabase.from("country_contributors").insert({
    user_id: me.user_id,
    country_code: country,
    role: parsed.data.role,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contribute");
  return { ok: true };
}

// ===========================================================================
// submitCpiBatch
// One submission per (country, category, period). The form submits 13 rows
// at once (categories 00..12). Each row is validated independently but
// shares the same source_url and submitter.
// ===========================================================================

// Reasonable index-value bounds. CPI indices are typically 50–500 with base
// 100. We allow generously but block obviously bogus inputs.
const IndexValueSchema = z.coerce.number().min(0).max(100000).finite();

const SubmitBatchInput = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  period: z.string().regex(/^\d{4}-\d{2}-01$/), // first day of month
  source_url: z.string().url().max(500),
  entries: z.record(z.string().regex(/^[0-9]{2}$/), IndexValueSchema),
});

export type SubmitState =
  | { ok: true; submitted_count: number }
  | { ok: false; error: string }
  | null;

const SUBMIT_DAILY_LIMIT_PER_PERIOD = 1; // anti-flood gate

export async function submitCpiBatch(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const entries: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^entry\[(\d{2})\]$/);
    if (m && typeof v === "string" && v.trim() !== "") entries[m[1]] = v;
  }
  const parsed = SubmitBatchInput.safeParse({
    country_code: formData.get("country_code"),
    period: formData.get("period"),
    source_url: formData.get("source_url"),
    entries,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please fill every category with a valid number, plus a valid source URL." };
  }
  const { country_code, period, source_url, entries: entryMap } = parsed.data;

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };

  // Authorization: must be active contributor for this country.
  const myContributor = activeContributorCountry(me.roles);
  if (myContributor !== country_code) {
    return { ok: false, error: "You're not an active contributor for that country." };
  }

  const supabase = await createClient();

  // Source URL whitelist check.
  const { data: whitelist } = await supabase
    .from("country_source_whitelist")
    .select("domain")
    .eq("country_code", country_code);
  const allowedDomains = (whitelist ?? []).map((r) => r.domain);
  if (!isUrlWhitelisted(source_url, allowedDomains)) {
    return {
      ok: false,
      error:
        allowedDomains.length === 0
          ? "No source URLs are whitelisted for this country yet. A moderator must add the official statistics office domain first."
          : "The source URL must be on an approved domain. Allowed: " +
            allowedDomains.join(", "),
    };
  }

  // Anti-flood: block submitting more than N batches for same (country, period) per day.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("cpi_submissions")
    .select("id", { count: "exact", head: true })
    .eq("submitted_by", me.user_id)
    .eq("country_code", country_code)
    .eq("period", period)
    .gte("submitted_at", dayAgo);
  if ((recentCount ?? 0) >= SUBMIT_DAILY_LIMIT_PER_PERIOD * 13) {
    return {
      ok: false,
      error: "You've already submitted this period today. Try again tomorrow.",
    };
  }

  // Build the 13 rows.
  const rows = Object.entries(entryMap).map(([category_code, index_value]) => ({
    country_code,
    category_code,
    period,
    index_value,
    source_url,
    submitted_by: me.user_id,
    submitter_country: country_code,
    status: "pending_review" as const,
  }));
  if (rows.length === 0) {
    return { ok: false, error: "At least one category value is required." };
  }

  const { error } = await supabase.from("cpi_submissions").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contribute");
  return { ok: true, submitted_count: rows.length };
}

// ===========================================================================
// reviewBatch / approveBatch
// Both operate on a (country_code, period, submitted_by) batch — the unit a
// contributor submitted. The reviewer/approver acts on all 13 rows at once.
// ===========================================================================

const BatchActionInput = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  submitted_by: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type BatchActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function reviewBatch(
  _prev: BatchActionState,
  formData: FormData,
): Promise<BatchActionState> {
  const parsed = BatchActionInput.safeParse({
    country_code: formData.get("country_code"),
    period: formData.get("period"),
    submitted_by: formData.get("submitted_by"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid review payload." };
  const { country_code, period, submitted_by, action, note } = parsed.data;

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!canReviewCountry(me.roles, country_code)) {
    return {
      ok: false,
      error:
        "You can't review submissions for this country. Either you're not an active reviewer, or you're a contributor for the same country.",
    };
  }
  const reviewerCountry = activeContributorCountry(me.roles); // may be null for global reviewers

  const supabase = await createClient();
  const new_status =
    action === "approve" ? "pending_approval" : "rejected";

  const { error } = await supabase
    .from("cpi_submissions")
    .update({
      reviewer_id: me.user_id,
      reviewer_country: reviewerCountry,
      reviewed_at: new Date().toISOString(),
      review_action: action,
      reviewer_note: note || null,
      status: new_status,
    })
    .eq("country_code", country_code)
    .eq("period", period)
    .eq("submitted_by", submitted_by)
    .eq("status", "pending_review");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contribute/review");
  revalidatePath("/contribute/approve");
  return { ok: true };
}

export async function approveBatch(
  _prev: BatchActionState,
  formData: FormData,
): Promise<BatchActionState> {
  const parsed = BatchActionInput.safeParse({
    country_code: formData.get("country_code"),
    period: formData.get("period"),
    submitted_by: formData.get("submitted_by"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid approval payload." };
  const { country_code, period, submitted_by, action, note } = parsed.data;

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!canApproveCountry(me.roles, country_code)) {
    return {
      ok: false,
      error:
        "You can't approve submissions for this country. Either you're not an active approver, or you're a contributor for the same country.",
    };
  }
  const approverCountry = activeContributorCountry(me.roles);

  const supabase = await createClient();
  const new_status = action === "approve" ? "live" : "rejected";

  // The check constraint blocks approver_id == reviewer_id at the DB level,
  // so trying to approve your own review fails atomically — no extra app check.
  const { error } = await supabase
    .from("cpi_submissions")
    .update({
      approver_id: me.user_id,
      approver_country: approverCountry,
      approved_at: new Date().toISOString(),
      approve_action: action,
      approver_note: note || null,
      status: new_status,
    })
    .eq("country_code", country_code)
    .eq("period", period)
    .eq("submitted_by", submitted_by)
    .eq("status", "pending_approval");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contribute/approve");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ===========================================================================
// Moderation: approve a contributor application (moderator only).
// ===========================================================================
const ModerateInput = z.object({
  user_id: z.string().uuid(),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  role: z.enum(["contributor", "reviewer", "approver", "moderator"]),
  decision: z.enum(["approve", "suspend", "reject"]),
});

export type ModerateState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function moderateApplication(
  _prev: ModerateState,
  formData: FormData,
): Promise<ModerateState> {
  const parsed = ModerateInput.safeParse({
    user_id: formData.get("user_id"),
    country_code: formData.get("country_code"),
    role: formData.get("role"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };

  // The RLS policy "moderators manage contributors" enforces this at the DB
  // level. We also check in the app for a clearer error.
  const isMod = me.roles.some(
    (r) => r.role === "moderator" && r.status === "active",
  );
  if (!isMod) return { ok: false, error: "Moderator access required." };

  const supabase = await createClient();

  if (parsed.data.decision === "reject") {
    const { error } = await supabase
      .from("country_contributors")
      .delete()
      .eq("user_id", parsed.data.user_id)
      .eq("country_code", parsed.data.country_code)
      .eq("role", parsed.data.role);
    if (error) return { ok: false, error: error.message };
  } else {
    const status = parsed.data.decision === "approve" ? "active" : "suspended";
    const update: Record<string, unknown> = {
      status,
      approved_by: me.user_id,
    };
    if (status === "active") update.approved_at = new Date().toISOString();
    if (status === "suspended") update.suspended_at = new Date().toISOString();

    const { error } = await supabase
      .from("country_contributors")
      .update(update)
      .eq("user_id", parsed.data.user_id)
      .eq("country_code", parsed.data.country_code)
      .eq("role", parsed.data.role);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ===========================================================================
// Moderation: manage source-URL whitelist.
// ===========================================================================
const WhitelistAddInput = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  domain: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i),
  description: z.string().trim().max(200).optional().or(z.literal("")),
});

export type WhitelistState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function addWhitelistDomain(
  _prev: WhitelistState,
  formData: FormData,
): Promise<WhitelistState> {
  const parsed = WhitelistAddInput.safeParse({
    country_code: formData.get("country_code"),
    domain: ((formData.get("domain") as string) ?? "").trim().toLowerCase(),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid domain." };

  const me = await loadMyRoles();
  if (!me) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("country_source_whitelist").insert({
    country_code: parsed.data.country_code,
    domain: parsed.data.domain,
    description: parsed.data.description || null,
    added_by: me.user_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

export async function removeWhitelistDomain(
  _prev: WhitelistState,
  formData: FormData,
): Promise<WhitelistState> {
  const country_code = formData.get("country_code");
  const domain = formData.get("domain");
  if (typeof country_code !== "string" || typeof domain !== "string") {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("country_source_whitelist")
    .delete()
    .eq("country_code", country_code)
    .eq("domain", domain);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
