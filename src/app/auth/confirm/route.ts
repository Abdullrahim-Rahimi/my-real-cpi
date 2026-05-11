import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Token-hash magic-link flow.
//
// The Supabase email template uses:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
//
// This flow does NOT require a PKCE code-verifier cookie, so it works across
// devices (user requests link on phone, clicks on laptop). It supersedes the
// older /auth/callback flow which only works on the same device/browser.
//
// /auth/callback is kept as a fallback for any links that were sent under
// the previous template (and for OAuth flows we may add later).

function safeOrigin(request: NextRequest): string {
  // Vercel sets x-forwarded-host to the user-facing host; prefer it so
  // redirects always go to the public domain even when the deployment URL
  // is also live.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV === "production") {
    return `https://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next");
  const origin = safeOrigin(request);

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/?error=missing_token", origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) {
    console.error("[/auth/confirm] verifyOtp failed:", error.message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  // Honor an explicit next param if it's a same-origin path; otherwise
  // route based on onboarding state.
  if (nextParam) {
    try {
      const target = new URL(nextParam, origin);
      if (target.origin === origin) {
        return NextResponse.redirect(target);
      }
    } catch {
      // fall through to default routing
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarded_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already-onboarded users go straight to their dashboard. First-time
  // confirmations land on /welcome which shows the "your email is
  // confirmed" hero + role-aware next steps.
  const dest = profile?.onboarded_at ? "/dashboard" : "/welcome";
  return NextResponse.redirect(new URL(dest, origin));
}
