// hCaptcha integration, behind a feature flag.
//
// When `HCAPTCHA_SECRET` is set in the environment, role-application server
// actions can require a `captcha_token` field in the form data and call
// `verifyCaptchaIfConfigured()` to validate it. When the env var is unset,
// the helper short-circuits to "valid" so the system remains usable in dev
// and on installs that don't yet have an hCaptcha account.
//
// To enable in production:
//   1. Sign up at https://www.hcaptcha.com — free for low-volume sites.
//   2. Set HCAPTCHA_SITEKEY (public) and HCAPTCHA_SECRET (server-only) in
//      Vercel project env vars.
//   3. Render the <h-captcha> widget on role-application forms; submit the
//      token as a hidden `captcha_token` form field.
//   4. Wire `verifyCaptchaIfConfigured(token)` into applyForRole / similar.

export type CaptchaResult = { ok: true } | { ok: false; reason: string };

export async function verifyCaptchaIfConfigured(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<CaptchaResult> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return { ok: true }; // feature flag off — pass through

  if (!token) return { ok: false, reason: "Missing captcha token." };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (json.success) return { ok: true };
    return {
      ok: false,
      reason: `Captcha verification failed: ${(json["error-codes"] ?? []).join(", ")}`,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Captcha check failed" };
  }
}

/** True iff the hCaptcha feature flag is currently enabled (server-side). */
export function isCaptchaEnabled(): boolean {
  return !!process.env.HCAPTCHA_SECRET;
}
