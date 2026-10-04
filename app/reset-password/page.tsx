import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import SiteFooter from "@/components/SiteFooter";
import PendingSubmit from "@/components/PendingSubmit";
import { createClient } from "@/lib/supabase/server";
import { RESET_COOKIE } from "@/lib/passwordReset";

export const metadata = {
  title: "Set a new password — Align",
};

async function setPassword(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  if (!user || !cookieStore.get(RESET_COOKIE)) redirect("/forgot-password?expired=1");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "That's your current password. Please choose a new one."
        : error.message;
    redirect(`/reset-password?error=${encodeURIComponent(message)}`);
  }

  cookieStore.delete(RESET_COOKIE);
  redirect("/app");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  // The reset link signs the user in and sets the reset cookie. Without both,
  // the link has expired, was already used, or this page was opened directly.
  const valid = !!user && !!cookieStore.get(RESET_COOKIE);

  return (
    <>
      <main className="auth-shell">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            align<span>.</span>
          </Link>
          {valid ? (
            <>
              <h1 className="auth-heading">Set a new password</h1>
              <p className="auth-sub">Choose a new password for {user.email}.</p>

              {params.error ? <div className="auth-error">{params.error}</div> : null}

              <form action={setPassword} className="auth-form">
                <label className="auth-label">
                  New password
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
                <PendingSubmit label="Save new password" pendingLabel="Saving..." />
              </form>
            </>
          ) : (
            <>
              <h1 className="auth-heading">This link has expired</h1>
              <p className="auth-sub">
                This password reset link has expired or has already been used.
                We can send you a new one.
              </p>
              <Link href="/forgot-password" className="btn-primary auth-submit">
                Send a new link
              </Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
