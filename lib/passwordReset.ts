// Password reset.
//
// The reset email link goes through /auth/callback, exactly like the sign-up
// confirmation link, so Supabase's allowed redirect URLs need no change. This
// cookie, set when the user asks for a reset, tells the callback to send them
// to /reset-password instead of /app. Supabase's own reset links only work in
// the browser that asked for them, so the cookie is always there when needed.
export const RESET_COOKIE = "align_pw_reset";
export const RESET_COOKIE_MAX_AGE = 60 * 60; // matches Supabase's 1-hour link expiry

export const RATE_LIMIT_MESSAGE =
  "We've just sent you an email. Please check your inbox, or try again in a minute.";

export function isEmailRateLimit(error: { code?: string; message: string }): boolean {
  return (
    error.code === "over_email_send_rate_limit" ||
    /for security purposes/i.test(error.message)
  );
}
