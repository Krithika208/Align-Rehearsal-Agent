import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import DebugPanel from "@/components/DebugPanel";
import AppClient from "./AppClient";
import { requireAppAccess } from "@/lib/subscription";

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

  // The founding perk is no longer shown (credits replaced the subscription);
  // getFoundingPerk and FoundingPerkCard are kept for now.
  const { freeSessionsUsed, outOfRehearsals } = await requireAppAccess();

  return (
    <>
      <AppClient
        freeSessionsUsed={freeSessionsUsed}
        outOfRehearsals={outOfRehearsals}
        initialVoice={initialVoice}
        userEmail={user.email ?? ""}
        userName={fullName}
      />
      <SiteFooter />
      <DebugPanel />
    </>
  );
}
