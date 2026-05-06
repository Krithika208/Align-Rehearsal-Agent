import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Log in — Align",
};

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/app");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectTo);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          align<span>.</span>
        </Link>
        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-sub">Log in to keep rehearsing.</p>

        {params.error ? (
          <div className="auth-error">{params.error}</div>
        ) : null}

        <form action={login} className="auth-form">
          <input type="hidden" name="redirectTo" value={params.redirectTo ?? "/app"} />
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
              autoComplete="current-password"
              className="auth-input"
            />
          </label>
          <button type="submit" className="btn-primary auth-submit">
            Log in
          </button>
        </form>

        <p className="auth-footer-link">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
