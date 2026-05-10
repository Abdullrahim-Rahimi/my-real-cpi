// One-click unsubscribe from monthly personal-CPI emails.
//
// The link is included in every personal-CPI email footer. Token is HMAC-
// signed with EMAIL_UNSUBSCRIBE_SECRET so we can flip the user's flag without
// requiring them to be signed in (which would defeat the "one-click" goal).

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return html("Missing token.", 400);

  const user_id = verifyUnsubscribeToken(token);
  if (!user_id) return html("This link is invalid or has expired.", 400);

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ notify_personal_cpi: false })
    .eq("user_id", user_id);
  if (error) {
    console.error("[/api/unsubscribe] update failed:", error.message);
    return html("Sorry — something went wrong. Try again in a minute.", 500);
  }

  return html(
    `<h1 style="margin:0 0 12px">You're unsubscribed.</h1>
     <p style="margin:0 0 16px">You won't receive any more monthly CPI update emails.</p>
     <p style="margin:0;font-size:14px;color:#737373">You can re-enable this any time on your dashboard.</p>`,
    200,
    true,
  );
}

function html(body: string, status: number, isHtml = false): NextResponse {
  const content = isHtml ? body : `<p>${body}</p>`;
  return new NextResponse(
    `<!doctype html><html><body style="margin:0;padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0a0a0a">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
<p style="margin:0 0 8px;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.06em">My Real CPI</p>
${content}
<p style="margin:24px 0 0"><a href="https://myrealcpi.com" style="color:#059669">myrealcpi.com</a></p>
</div>
</body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
