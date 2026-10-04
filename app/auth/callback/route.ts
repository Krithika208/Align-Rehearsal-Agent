import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESET_COOKIE } from "@/lib/passwordReset";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  // Set when this browser asked for a password reset (see lib/passwordReset.ts).
  const isReset = request.cookies.has(RESET_COOKIE);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${isReset ? "/reset-password" : next}`);
    }
    if (isReset) {
      return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // No code: Supabase sends expired or already-used links back without one.
  if (isReset) {
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
