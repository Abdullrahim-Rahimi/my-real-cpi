import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Legacy PKCE magic-link callback. Kept as a fallback for:
//   - Magic links sent under the old email template ({{ .ConfirmationURL }})
//   - Future OAuth flows that use code-exchange
//
// New token-hash flow lives at /auth/confirm and is cross-device safe.
function safeOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV === "production") {
    return `https://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const origin = safeOrigin(request);

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[/auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(new URL(next, origin));
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

  const dest = profile?.onboarded_at ? "/dashboard" : "/welcome";
  return NextResponse.redirect(new URL(dest, origin));
}
