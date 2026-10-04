import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { RESET_COOKIE, RESET_COOKIE_MAX_AGE } from "@/lib/passwordReset";

// Email links (sign-up confirmation and password reset) land here, following
// Supabase's token-hash approach for server-side auth. The link carries a
// one-time token, so it works in any browser, app or device, unlike the code
// links /auth/callback handles, which only work in the browser that asked.
// The email templates in emails/ point here:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || (type !== "recovery" && type !== "email" && type !== "signup")) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (type === "recovery") {
    if (error) return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
    // Signed in by the link. The cookie lets /reset-password show its form.
    const res = NextResponse.redirect(`${origin}/reset-password`);
    res.cookies.set(RESET_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RESET_COOKIE_MAX_AGE,
    });
    return res;
  }

  // Sign-up confirmation. A used or expired token usually means the email is
  // already confirmed (for example, an email scanner opened the link first).
  if (error) return NextResponse.redirect(`${origin}/login?link=expired`);
  return NextResponse.redirect(`${origin}/app`);
}
