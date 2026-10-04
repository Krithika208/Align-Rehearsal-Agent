import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import SiteFooter from "@/components/SiteFooter";
import PendingSubmit from "@/components/PendingSubmit";
import { createClient } from "@/lib/supabase/server";
import {
  RATE_LIMIT_MESSAGE,
  RESET_COOKIE,
  RESET_COOKIE_MAX_AGE,
  isEmailRateLimit,
} from "@/lib/passwordReset";

export const metadata = {
  title: "Reset your password — Align",
};

async function requestReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("host");
  const redirectTo = origin
    ? `${origin.startsWith("http") ? origin : `https://${origin}`}/auth/callback`
    : undefined;

  const cookieStore = await cookies();
  cookieStore.set(RESET_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_COOKIE_MAX_AGE,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    if (isEmailRateLimit(error)) {
      redirect(`/forgot-password?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
    }
    // Anything else: still show the same message, so the page never reveals
    // whether an account exists. Log it for us.
    console.error("[forgot-password] reset request failed:", error.message);
  }

  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; expired?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.sent) {
    return (
      <>
        <main className="auth-shell">
          <div className="auth-card">
            <Link href="/" className="auth-logo">
              align<span>.</span>
            </Link>
            <h1 className="auth-heading">Check your email</h1>
            <p className="auth-sub">
              If an account exists for that email, we&apos;ve sent a link to reset
              your password.
            </p>
            <Link href="/login" className="btn-primary auth-submit">
              Back to log in
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <main className="auth-shell">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            align<span>.</span>
          </Link>
          <h1 className="auth-heading">Reset your password</h1>
          <p className="auth-sub">
            Enter the email you signed up with and we&apos;ll send you a link to set
            a new password.
          </p>

          {params.expired ? (
            <div className="auth-error">
              That reset link has expired or has already been used. Enter your
              email and we&apos;ll send you a new one.
            </div>
          ) : null}
          {params.error ? <div className="auth-error">{params.error}</div> : null}

          <form action={requestReset} className="auth-form">
            <label className="auth-label">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="auth-input"
              />
            </label>
            <PendingSubmit label="Send reset link" pendingLabel="Sending..." />
          </form>

          <p className="auth-footer-link">
            Remembered it? <Link href="/login">Log in</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
