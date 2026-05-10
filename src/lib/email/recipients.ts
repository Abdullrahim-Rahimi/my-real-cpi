// Email recipient lookups.
//
// All functions use the service-role client because they read auth.users —
// regular RLS clients can't see emails of other users. These should NEVER be
// imported from a client component.

import { createServiceClient } from "@/lib/supabase/server";

async function emailsFor(userIds: readonly string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const supabase = createServiceClient();
  const out: string[] = [];
  // The auth admin API exposes one user at a time. For the small role
  // populations we expect (a few moderators, dozens of reviewers/approvers
  // at scale), this is fine. If queues grow large, batch via listUsers.
  for (const id of userIds) {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error) {
      console.error("[email] getUserById failed for", id, error.message);
      continue;
    }
    if (data.user?.email) out.push(data.user.email);
  }
  return Array.from(new Set(out));
}

/** Emails of every active moderator. Used when an admin action is needed. */
export async function moderatorEmails(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("country_contributors")
    .select("user_id")
    .eq("role", "moderator")
    .eq("status", "active");
  return emailsFor((data ?? []).map((r) => r.user_id as string));
}

/** Email of a single user (used for personal status notifications). */
export async function userEmail(user_id: string): Promise<string | null> {
  const out = await emailsFor([user_id]);
  return out[0] ?? null;
}

/**
 * Eligible reviewers for a submission in `country_code` — active reviewers
 * (or moderators) who are NOT also active contributors for that country.
 * Used to notify reviewers when a new batch arrives.
 */
export async function reviewerEmails(country_code: string): Promise<string[]> {
  const supabase = createServiceClient();
  const [{ data: roleRows }, { data: contributorsHere }] = await Promise.all([
    supabase
      .from("country_contributors")
      .select("user_id")
      .in("role", ["reviewer", "moderator"])
      .eq("status", "active"),
    supabase
      .from("country_contributors")
      .select("user_id")
      .eq("country_code", country_code)
      .eq("role", "contributor")
      .eq("status", "active"),
  ]);

  const excluded = new Set<string>(
    (contributorsHere ?? []).map((r) => r.user_id as string),
  );
  const eligible = (roleRows ?? [])
    .map((r) => r.user_id as string)
    .filter((id) => !excluded.has(id));
  return emailsFor(eligible);
}

/**
 * Eligible approvers — same shape as reviewers, but excludes the reviewer
 * themselves so we don't ping them about a batch they just reviewed (the DB
 * separately blocks reviewer = approver).
 */
export async function approverEmails({
  country_code,
  exclude_user_ids = [],
}: {
  country_code: string;
  exclude_user_ids?: string[];
}): Promise<string[]> {
  const supabase = createServiceClient();
  const [{ data: roleRows }, { data: contributorsHere }] = await Promise.all([
    supabase
      .from("country_contributors")
      .select("user_id")
      .in("role", ["approver", "moderator"])
      .eq("status", "active"),
    supabase
      .from("country_contributors")
      .select("user_id")
      .eq("country_code", country_code)
      .eq("role", "contributor")
      .eq("status", "active"),
  ]);

  const excluded = new Set<string>([
    ...(contributorsHere ?? []).map((r) => r.user_id as string),
    ...exclude_user_ids,
  ]);
  const eligible = (roleRows ?? [])
    .map((r) => r.user_id as string)
    .filter((id) => !excluded.has(id));
  return emailsFor(eligible);
}
