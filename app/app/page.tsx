import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import DebugPanel from "@/components/DebugPanel";
import AppClient from "./AppClient";
import { getFoundingPerk, requireAppAccess } from "@/lib/subscription";

export const metadata = {
  title: "Rehearse — Align",
};

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

  const initialVoice =
    user.user_metadata?.preferred_voice === "male" ? "male" : "female";

  const [{ freeSessionsUsed }, foundingPerk] = await Promise.all([
    requireAppAccess(),
    getFoundingPerk(),
  ]);

  return (
    <>
      <AppClient
        freeSessionsUsed={freeSessionsUsed}
        foundingPerk={foundingPerk}
        initialVoice={initialVoice}
        userEmail={user.email ?? ""}
        userName={fullName}
      />
      <SiteFooter />
      <DebugPanel />
    </>
  );
}
