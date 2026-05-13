import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import AppClient from "./AppClient";

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

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <>
      <AppClient
        userEmail={user.email ?? ""}
        userName={fullName}
        logoutAction={logout}
      />
      <SiteFooter />
    </>
  );
}
