"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Saves the user's one-time sensitive-data consent. Only the server can
// write it (service role); a date that's already set is never changed.
export async function giveSensitiveConsent(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await createServiceRoleClient().rpc("record_sensitive_consent", {
    p_user_id: user.id,
  });
  if (error) {
    console.error("[consent] record_sensitive_consent failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
