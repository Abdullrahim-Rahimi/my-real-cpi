// High-level "notify" functions wired into the community server actions.
//
// Each function:
//   1. Looks up the right recipients (using service-role for auth.users access)
//   2. Builds the subject/text/html
//   3. Sends via Mailgun
//   4. Logs but never throws — email is fire-and-forget; an outage shouldn't
//      take down the underlying user action.
//
// Always called inside Next 15's `after()` so the user response is returned
// before the email round-trip. Vercel keeps the function alive for ~30s
// after the response, which is plenty for these.

import { sendEmail, isEmailConfigured } from "./mailgun";
import {
  approverEmails,
  moderatorEmails,
  reviewerEmails,
  userEmail,
} from "./recipients";
import {
  applicationDecision,
  batchLive,
  batchRejected,
  newApplication,
  newSubmissionForReviewers,
  reviewedForApprovers,
} from "./templates";

const TAG = "[notify]";

function logSkip(reason: string) {
  if (!isEmailConfigured()) {
    console.warn(`${TAG} ${reason} — Mailgun not configured, no email sent`);
  }
}

// ---------------------------------------------------------------------------
// 1. New contributor / reviewer / approver application → moderators
// ---------------------------------------------------------------------------
export async function notifyNewApplication(args: {
  applicant_user_id: string;
  country_code: string;
  country_name: string;
  role: "contributor" | "reviewer" | "approver";
  note: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return logSkip("notifyNewApplication");
  try {
    const [recipients, applicant] = await Promise.all([
      moderatorEmails(),
      userEmail(args.applicant_user_id),
    ]);
    if (recipients.length === 0) return;
    const tmpl = newApplication({
      applicant_email: applicant ?? args.applicant_user_id,
      country_name: args.country_name,
      country_code: args.country_code,
      role: args.role,
      note: args.note,
    });
    await sendEmail({ to: recipients, ...tmpl });
  } catch (e) {
    console.error(`${TAG} notifyNewApplication failed:`, e);
  }
}

// ---------------------------------------------------------------------------
// 2. Moderator decision → applicant
// ---------------------------------------------------------------------------
export async function notifyApplicationDecision(args: {
  user_id: string;
  country_name: string;
  role: "contributor" | "reviewer" | "approver" | "moderator";
  decision: "approve" | "suspend" | "reject";
}): Promise<void> {
  if (!isEmailConfigured()) return logSkip("notifyApplicationDecision");
  if (args.role === "moderator") return; // not a user-facing flow
  try {
    const recipient = await userEmail(args.user_id);
    if (!recipient) return;
    const tmpl = applicationDecision({
      country_name: args.country_name,
      role: args.role,
      decision: args.decision,
    });
    await sendEmail({ to: recipient, ...tmpl });
  } catch (e) {
    console.error(`${TAG} notifyApplicationDecision failed:`, e);
  }
}

// ---------------------------------------------------------------------------
// 3. New batch submitted → reviewers
// ---------------------------------------------------------------------------
export async function notifyNewSubmission(args: {
  country_code: string;
  country_name: string;
  period: string;
  source_url: string;
}): Promise<void> {
  if (!isEmailConfigured()) return logSkip("notifyNewSubmission");
  try {
    const recipients = await reviewerEmails(args.country_code);
    if (recipients.length === 0) return;
    const tmpl = newSubmissionForReviewers(args);
    await sendEmail({ to: recipients, ...tmpl });
  } catch (e) {
    console.error(`${TAG} notifyNewSubmission failed:`, e);
  }
}

// ---------------------------------------------------------------------------
// 4. Review decision
//    - approve → approvers
//    - reject  → contributor
// ---------------------------------------------------------------------------
export async function notifyReviewDecision(args: {
  country_code: string;
  country_name: string;
  period: string;
  source_url: string;
  submitter_user_id: string;
  reviewer_user_id: string;
  action: "approve" | "reject";
  note: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return logSkip("notifyReviewDecision");
  try {
    if (args.action === "approve") {
      const recipients = await approverEmails({
        country_code: args.country_code,
        exclude_user_ids: [args.reviewer_user_id, args.submitter_user_id],
      });
      if (recipients.length === 0) return;
      const tmpl = reviewedForApprovers(args);
      await sendEmail({ to: recipients, ...tmpl });
    } else {
      const recipient = await userEmail(args.submitter_user_id);
      if (!recipient) return;
      const tmpl = batchRejected({
        country_name: args.country_name,
        period: args.period,
        stage: "review",
        note: args.note,
      });
      await sendEmail({ to: recipient, ...tmpl });
    }
  } catch (e) {
    console.error(`${TAG} notifyReviewDecision failed:`, e);
  }
}

// ---------------------------------------------------------------------------
// 5. Approval decision → contributor
// ---------------------------------------------------------------------------
export async function notifyApprovalDecision(args: {
  country_code: string;
  country_name: string;
  period: string;
  submitter_user_id: string;
  action: "approve" | "reject";
  note: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return logSkip("notifyApprovalDecision");
  try {
    const recipient = await userEmail(args.submitter_user_id);
    if (!recipient) return;
    const tmpl =
      args.action === "approve"
        ? batchLive({
            country_name: args.country_name,
            country_code: args.country_code,
            period: args.period,
          })
        : batchRejected({
            country_name: args.country_name,
            period: args.period,
            stage: "approval",
            note: args.note,
          });
    await sendEmail({ to: recipient, ...tmpl });
  } catch (e) {
    console.error(`${TAG} notifyApprovalDecision failed:`, e);
  }
}
