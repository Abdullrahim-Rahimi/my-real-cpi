// Mailgun HTTP API sender.
//
// We use Mailgun's HTTP messages endpoint instead of SMTP because:
//   1. No nodemailer dependency — native fetch + URLSearchParams.
//   2. Cleaner error semantics — HTTP status codes + JSON errors.
//   3. Doesn't conflict with Supabase's SMTP usage (which sends auth emails
//      with the same credentials but on a different code path).
//
// Required env vars (graceful no-op when unset, so dev/preview environments
// without Mailgun configured don't fail the action):
//   - MAILGUN_API_KEY    Mailgun account API key (`d279...` style)
//   - MAILGUN_DOMAIN     e.g. "myrealcpi.com"
// Optional:
//   - MAILGUN_REGION     "us" (default) | "eu"
//   - MAILGUN_FROM       full From header; defaults to "My Real CPI <noreply@${MAILGUN_DOMAIN}>"

const REGION_HOSTS: Record<string, string> = {
  us: "https://api.mailgun.net",
  eu: "https://api.eu.mailgun.net",
};

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  /** When true, log debug info even on success. */
  debug?: boolean;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; reason: string };

export function isEmailConfigured(): boolean {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    if (args.debug) {
      console.warn("[email] MAILGUN_API_KEY/MAILGUN_DOMAIN not set — skipping send");
    }
    return { ok: false, reason: "not_configured" };
  }

  const region = (process.env.MAILGUN_REGION ?? "us").toLowerCase();
  const base = REGION_HOSTS[region] ?? REGION_HOSTS.us;
  const from =
    args.from ??
    process.env.MAILGUN_FROM ??
    `My Real CPI <noreply@${domain}>`;

  const recipients = (Array.isArray(args.to) ? args.to : [args.to]).filter(Boolean);
  if (recipients.length === 0) {
    return { ok: false, reason: "no_recipients" };
  }

  const body = new URLSearchParams();
  body.set("from", from);
  for (const r of recipients) body.append("to", r);
  body.set("subject", args.subject);
  body.set("text", args.text);
  if (args.html) body.set("html", args.html);

  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`api:${apiKey}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[email] Mailgun send failed:",
        res.status,
        text.slice(0, 300),
        "to=",
        recipients,
      );
      return { ok: false, reason: `http_${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    if (args.debug) console.log("[email] sent:", json.id, "to=", recipients);
    return { ok: true, id: json.id };
  } catch (e) {
    console.error("[email] send error:", e);
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
