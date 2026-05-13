import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign up — Align",
};

async function signup(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("host");
  const emailRedirectTo = origin
    ? `${origin.startsWith("http") ? origin : `https://${origin}`}/auth/callback`
    : undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?check_email=1");
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const params = await searchParams;

  if (params.check_email) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            align<span>.</span>
          </Link>
          <h1 className="auth-heading">Check your email</h1>
          <p className="auth-sub">
            We sent a confirmation link. Click it to activate your account, then
            log in.
          </p>
          <Link href="/login" className="btn-primary auth-submit">
            Go to log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          align<span>.</span>
        </Link>
        <h1 className="auth-heading">Create your account</h1>
        <p className="auth-sub">Start rehearsing the conversations you&apos;ve been avoiding.</p>

        {params.error ? (
          <div className="auth-error">{params.error}</div>
        ) : null}

        <form action={signup} className="auth-form">
          <label className="auth-label">
            Full name
            <input
              type="text"
              name="full_name"
              required
              autoComplete="name"
              className="auth-input"
            />
          </label>
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
          <label className="auth-label">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="auth-input"
            />
            <span className="auth-hint">At least 8 characters.</span>
          </label>
          <button type="submit" className="btn-primary auth-submit">
            Create account
          </button>
          <p className="auth-consent">
            By signing up, you agree to our{" "}
            <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>, and acknowledge our{" "}
            <Link href="/disclaimer">AI Coaching Disclaimer</Link>.
          </p>
        </form>

        <p className="auth-footer-link">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
