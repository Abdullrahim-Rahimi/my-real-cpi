// Templated subject/text/html for each notification type.
//
// Plain-text is always populated as a fallback for clients that don't render
// HTML; HTML adds a button-styled CTA. Keep templates compact: no images, no
// custom fonts, inline styles only — better deliverability.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://myrealcpi.com";

export type Email = { subject: string; text: string; html: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

function fmtPeriod(period: string): string {
  return new Date(period).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.06em">My Real CPI</p>
<h2 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h2>
${body}
</div>
<p style="max-width:560px;margin:16px auto 0;color:#737373;font-size:12px;text-align:center">
You received this because you have an active role in the My Real CPI community pipeline.
<br><a href="${SITE}" style="color:#737373">myrealcpi.com</a>
</p>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#059669;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

// =============================================================================
// 1. New contributor application -> moderators
// =============================================================================
export function newApplication(p: {
  applicant_email: string;
  country_name: string;
  country_code: string;
  role: "contributor" | "reviewer" | "approver";
  note: string | null;
}): Email {
  const subject = `[My Real CPI] New ${p.role} application — ${p.country_name}`;
  const text = [
    `${p.applicant_email} applied to be a ${p.role}${p.role === "contributor" ? ` for ${p.country_name}` : ""}.`,
    "",
    p.note ? `Their note:\n  ${p.note}\n` : "",
    `Review: ${SITE}/admin/applications`,
  ].filter(Boolean).join("\n");
  const html = shell(
    "New community application",
    `<p style="margin:0 0 12px;line-height:1.5"><strong>${escapeHtml(p.applicant_email)}</strong> applied to be a <strong>${p.role}</strong>${p.role === "contributor" ? ` for <strong>${escapeHtml(p.country_name)}</strong> (${p.country_code})` : ""}.</p>
    ${p.note ? `<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #d4d4d8;color:#52525b">${escapeHtml(p.note)}</blockquote>` : ""}
    ${button("Review applications", `${SITE}/admin/applications`)}`,
  );
  return { subject, text, html };
}

// =============================================================================
// 2. Application decision -> applicant
// =============================================================================
export function applicationDecision(p: {
  country_name: string;
  role: "contributor" | "reviewer" | "approver";
  decision: "approve" | "suspend" | "reject";
}): Email {
  const isApproved = p.decision === "approve";
  const subject = isApproved
    ? `[My Real CPI] You're now a ${p.role}${p.role === "contributor" ? ` for ${p.country_name}` : ""}`
    : `[My Real CPI] Your ${p.role} application was ${p.decision}ed`;

  const cta = isApproved && p.role === "contributor"
    ? { label: "Submit your first batch", href: `${SITE}/contribute/submit` }
    : isApproved && p.role === "reviewer"
      ? { label: "Open the review queue", href: `${SITE}/contribute/review` }
      : isApproved && p.role === "approver"
        ? { label: "Open the approval queue", href: `${SITE}/contribute/approve` }
        : { label: "Back to My Real CPI", href: SITE };

  const lead = isApproved
    ? `Your ${p.role} application has been approved. ${p.role === "contributor" ? `You can now submit official CPI data for ${p.country_name} each month.` : "You can now act on the queue."}`
    : `Your ${p.role} application was ${p.decision}ed. If you think this was a mistake, reply to this email.`;

  return {
    subject,
    text: `${lead}\n\n${cta.label}: ${cta.href}`,
    html: shell(
      isApproved ? "Application approved" : `Application ${p.decision}ed`,
      `<p style="margin:0;line-height:1.5">${escapeHtml(lead)}</p>${button(cta.label, cta.href)}`,
    ),
  };
}

// =============================================================================
// 3. New batch submitted -> reviewers
// =============================================================================
export function newSubmissionForReviewers(p: {
  country_name: string;
  country_code: string;
  period: string;
  source_url: string;
}): Email {
  const subject = `[My Real CPI] New batch waiting for review — ${p.country_name} ${fmtPeriod(p.period)}`;
  const text = [
    `A new CPI batch was submitted for ${p.country_name} (${p.country_code}) for ${fmtPeriod(p.period)}.`,
    `Source: ${p.source_url}`,
    "",
    `Review: ${SITE}/contribute/review`,
  ].join("\n");
  const html = shell(
    "Batch waiting for your review",
    `<p style="margin:0 0 12px;line-height:1.5">A new CPI batch was submitted for <strong>${escapeHtml(p.country_name)}</strong> (${p.country_code}) for <strong>${fmtPeriod(p.period)}</strong>.</p>
    <p style="margin:8px 0;font-size:14px;color:#52525b">Source: <a href="${escapeHtml(p.source_url)}" style="color:#059669">${escapeHtml(p.source_url)}</a></p>
    ${button("Open the review queue", `${SITE}/contribute/review`)}`,
  );
  return { subject, text, html };
}

// =============================================================================
// 4a. Review approved -> approvers
// =============================================================================
export function reviewedForApprovers(p: {
  country_name: string;
  country_code: string;
  period: string;
  source_url: string;
}): Email {
  const subject = `[My Real CPI] Batch ready for approval — ${p.country_name} ${fmtPeriod(p.period)}`;
  const text = [
    `A reviewer signed off on the ${p.country_name} batch for ${fmtPeriod(p.period)}. It's now waiting for an approver.`,
    `Source: ${p.source_url}`,
    "",
    `Approve: ${SITE}/contribute/approve`,
  ].join("\n");
  const html = shell(
    "Batch ready for your approval",
    `<p style="margin:0 0 12px;line-height:1.5">A reviewer signed off on the <strong>${escapeHtml(p.country_name)}</strong> batch for <strong>${fmtPeriod(p.period)}</strong>. It&#39;s now waiting for an approver in a third country.</p>
    <p style="margin:8px 0;font-size:14px;color:#52525b">Source: <a href="${escapeHtml(p.source_url)}" style="color:#059669">${escapeHtml(p.source_url)}</a></p>
    ${button("Open the approval queue", `${SITE}/contribute/approve`)}`,
  );
  return { subject, text, html };
}

// =============================================================================
// 4b. Review rejected -> contributor
// 5b. Approval rejected -> contributor
// =============================================================================
export function batchRejected(p: {
  country_name: string;
  period: string;
  stage: "review" | "approval";
  note: string | null;
}): Email {
  const subject = `[My Real CPI] Your ${p.country_name} ${fmtPeriod(p.period)} batch was rejected at ${p.stage}`;
  const text = [
    `Your ${p.country_name} batch for ${fmtPeriod(p.period)} was rejected at the ${p.stage} stage.`,
    p.note ? `\nReviewer note:\n  ${p.note}` : "",
    "",
    `You can correct the data and submit again: ${SITE}/contribute/submit`,
  ].filter(Boolean).join("\n");
  const html = shell(
    "Batch rejected",
    `<p style="margin:0 0 8px;line-height:1.5">Your <strong>${escapeHtml(p.country_name)}</strong> batch for <strong>${fmtPeriod(p.period)}</strong> was rejected at the <strong>${p.stage}</strong> stage.</p>
    ${p.note ? `<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #fca5a5;color:#52525b">${escapeHtml(p.note)}</blockquote>` : ""}
    <p style="margin:0;line-height:1.5">You can correct the data and submit again.</p>
    ${button("Submit a new batch", `${SITE}/contribute/submit`)}`,
  );
  return { subject, text, html };
}

// =============================================================================
// 5a. Approval approved -> contributor
// =============================================================================
export function batchLive(p: {
  country_name: string;
  country_code: string;
  period: string;
}): Email {
  const subject = `[My Real CPI] Your ${p.country_name} ${fmtPeriod(p.period)} data is live 🎉`;
  const text = [
    `Your CPI batch for ${p.country_name}, ${fmtPeriod(p.period)}, has been approved and is now live.`,
    `Anyone in ${p.country_name} can see their personal CPI based on your numbers.`,
    "",
    `View: ${SITE}/dashboard`,
  ].join("\n");
  const html = shell(
    "Your batch is live",
    `<p style="margin:0 0 8px;line-height:1.5">Your CPI batch for <strong>${escapeHtml(p.country_name)}</strong>, <strong>${fmtPeriod(p.period)}</strong>, has been approved.</p>
    <p style="margin:0;line-height:1.5">Anyone in ${escapeHtml(p.country_name)} can now see their personal CPI based on your numbers. Thanks for keeping the data fresh.</p>
    ${button("Open dashboard", `${SITE}/dashboard`)}`,
  );
  return { subject, text, html };
}
