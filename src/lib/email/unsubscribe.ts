// HMAC-signed unsubscribe tokens for one-click opt-out from emails.
//
// Format: `<user_id>.<base64url(HMAC-SHA256(SECRET, user_id))>`
// Stateless — no token table — but rotation invalidates all live links.
// The secret lives in EMAIL_UNSUBSCRIBE_SECRET; if unset we deliberately
// fail closed rather than minting unsigned links.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not set");
  return s;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function makeUnsubscribeToken(user_id: string): string {
  const sig = createHmac("sha256", secret()).update(user_id).digest();
  return `${user_id}.${base64url(sig)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const i = token.indexOf(".");
  if (i <= 0) return null;
  const user_id = token.slice(0, i);
  const sig = token.slice(i + 1);
  let expected: string;
  try {
    expected = base64url(
      createHmac("sha256", secret()).update(user_id).digest(),
    );
  } catch {
    return null;
  }
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? user_id : null;
}

/** Public URL for the unsubscribe endpoint, embedded in email footers. */
export function unsubscribeUrl(user_id: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://myrealcpi.com";
  return `${site}/api/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(user_id))}`;
}
