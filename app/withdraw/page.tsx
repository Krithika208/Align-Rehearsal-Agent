import type { Metadata } from "next";
import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import SiteFooter from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import WithdrawForm from "./WithdrawForm";

export const metadata: Metadata = {
  title: "Cancel a purchase — Align",
  description: "UK and EEA customers can cancel a purchase within 14 days.",
};

// Model withdrawal form, linked from Terms section 7. Same layout as the
// legal pages.
export default async function WithdrawPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <nav>
        <Link href="/" className="logo" aria-label="Align home">
          <img src="/brand/align-lockup-navy.svg" alt="Align" width={115} height={32} />
        </Link>
        <HeaderMenu
          variant="site"
          loggedIn={!!user}
          links={[
            user
              ? { href: "/account", label: "Account" }
              : { href: "/login", label: "Sign in" },
            { href: "https://livealign.co", label: "Coaching" },
          ]}
        />
      </nav>
      <main className="legal-shell">
        <article className="legal-article">
          <h1>Cancel a purchase (UK and EEA)</h1>
          <p>
            If you live in the UK or the European Economic Area, you can cancel a
            purchase within 14 days of making it. We&apos;ll refund the credits
            from that purchase that you haven&apos;t used.
          </p>
          <WithdrawForm defaultEmail={user?.email ?? ""} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
