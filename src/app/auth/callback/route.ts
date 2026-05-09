import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link click lands here. Exchange the code for a session, then redirect
// based on whether the user has finished onboarding.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // If the magic link specified a next URL (e.g. /onboarding), honor it.
  if (next && next.startsWith("/")) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Otherwise, route based on onboarding state.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarded_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const dest = profile?.onboarded_at ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(new URL(dest, url.origin));
}
