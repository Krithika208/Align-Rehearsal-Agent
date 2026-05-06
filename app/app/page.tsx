import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Your rehearsals — Align",
};

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          align<span>.</span>
        </Link>
        <h1 className="auth-heading">Welcome, {user.email}</h1>
        <p className="auth-sub">
          You&apos;re logged in. Scenario picker and rehearsal flow coming soon.
        </p>
        <form action={logout}>
          <button type="submit" className="btn-secondary auth-submit">
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
