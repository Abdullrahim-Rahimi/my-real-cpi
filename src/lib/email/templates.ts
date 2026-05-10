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
// 6. Monthly personal-CPI update -> end users
// =============================================================================
export function personalCpiUpdate(p: {
  country_name: string;
  period: string;
  personal_yoy_pct: number;
  official_yoy_pct: number | null;
  coverage_pct: number;
  top_movers: { short_name: string; yoy_pct: number; weight: number }[];
  unsubscribe_url: string;
}): Email {
  const sign = (n: number) => (n > 0 ? "+" : "");
  const personalStr = `${sign(p.personal_yoy_pct)}${p.personal_yoy_pct.toFixed(1)}%`;
  const officialStr =
    p.official_yoy_pct == null
      ? "n/a"
      : `${sign(p.official_yoy_pct)}${p.official_yoy_pct.toFixed(1)}%`;
  const periodLabel = fmtPeriod(p.period);

  const compareLine =
    p.official_yoy_pct == null
      ? `Official headline: ${officialStr}.`
      : p.personal_yoy_pct > p.official_yoy_pct
        ? `That's ${(p.personal_yoy_pct - p.official_yoy_pct).toFixed(1)} pp above the headline (${officialStr}).`
        : `That's ${(p.official_yoy_pct - p.personal_yoy_pct).toFixed(1)} pp below the headline (${officialStr}).`;

  const subject = `[My Real CPI] Your ${periodLabel} personal CPI: ${personalStr}`;

  const moverLinesText = p.top_movers
    .map(
      (m) =>
        `  • ${m.short_name}: ${sign(m.yoy_pct)}${m.yoy_pct.toFixed(1)}% YoY (${(m.weight * 100).toFixed(0)}% of your spend)`,
    )
    .join("\n");

  const text = [
    `Your personal CPI for ${periodLabel} is ${personalStr}.`,
    "",
    compareLine,
    "",
    "Top contributors:",
    moverLinesText,
    "",
    `View the full breakdown: ${SITE}/dashboard`,
    "",
    `Don't want these emails? Unsubscribe: ${p.unsubscribe_url}`,
  ].join("\n");

  const moverRowsHtml = p.top_movers
    .map(
      (m) => `<tr>
<td style="padding:6px 0;color:#0a0a0a">${escapeHtml(m.short_name)}</td>
<td style="padding:6px 0;text-align:right;color:#0a0a0a;font-variant-numeric:tabular-nums"><strong>${sign(m.yoy_pct)}${m.yoy_pct.toFixed(1)}%</strong></td>
<td style="padding:6px 0;text-align:right;color:#737373;font-size:13px;font-variant-numeric:tabular-nums">${(m.weight * 100).toFixed(0)}% of spend</td>
</tr>`,
    )
    .join("");

  const html = shell(
    `Your ${periodLabel} personal CPI`,
    `<p style="margin:0 0 16px;font-size:14px;color:#737373">${escapeHtml(p.country_name)} · ${periodLabel}</p>
<div style="display:flex;gap:16px;margin:0 0 16px">
  <div style="flex:1;padding:16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px">
    <p style="margin:0;font-size:12px;color:#065f46;font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Your real CPI</p>
    <p style="margin:6px 0 0;font-size:32px;color:#064e3b;font-weight:700;font-variant-numeric:tabular-nums">${personalStr}</p>
  </div>
  <div style="flex:1;padding:16px;background:#fafafa;border:1px solid #e5e7eb;border-radius:10px">
    <p style="margin:0;font-size:12px;color:#525252;font-weight:500;text-transform:uppercase;letter-spacing:0.04em">Official</p>
    <p style="margin:6px 0 0;font-size:32px;color:#171717;font-weight:700;font-variant-numeric:tabular-nums">${officialStr}</p>
  </div>
</div>
<p style="margin:0 0 4px;line-height:1.5">${escapeHtml(compareLine)}</p>
<p style="margin:0 0 20px;font-size:13px;color:#737373">Coverage ${(p.coverage_pct * 100).toFixed(0)}% of your spend has matched data this period.</p>
<h3 style="margin:24px 0 8px;font-size:15px">Top contributors</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px">${moverRowsHtml}</table>
${button("Open dashboard", `${SITE}/dashboard`)}
<p style="margin:32px 0 0;font-size:11px;color:#a3a3a3">Don't want monthly CPI emails? <a href="${escapeHtml(p.unsubscribe_url)}" style="color:#a3a3a3">Unsubscribe</a>.</p>`,
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
