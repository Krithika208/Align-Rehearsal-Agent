import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { deletePostHogPerson } from "@/lib/posthogAdmin";
import { sendPostHogDeleteReminder } from "@/lib/emails/posthog-delete-reminder";

export const runtime = "nodejs";

const ENDED_STATUSES = ["canceled", "incomplete_expired"];

// Deletes the signed-in user's account for good. Deleting the Supabase user
// removes every row tied to it (rehearsals, outcomes, credits, counters,
// subscription row, founding perk: all "on delete cascade"). Stripe payment
// records stay, as the law requires. The body must be { confirm: "DELETE" }.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // A subscription still running would keep charging after the account is
  // gone, so cancel it first. If that fails, stop: delete nothing.
  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.stripe_subscription_id && !ENDED_STATUSES.includes(sub.status)) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      console.error("[delete-account] Stripe cancel failed:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Couldn't cancel your subscription, so nothing was deleted. Please email privacy@livealign.co." },
        { status: 500 }
      );
    }
  }

  // PostHog person and events. Best-effort: never blocks deletion. If the
  // app can't do it (no key on the free plan, or an error), Krithika gets an
  // email to delete them by hand once the account is gone.
  let postHogByHand = false;
  try {
    const result = await deletePostHogPerson(user.id);
    if (result === "not_configured") postHogByHand = true;
    else if (result === "not_found") console.log(`[delete-account] PostHog: no person for ${user.id}`);
  } catch (err) {
    postHogByHand = true;
    console.error(
      `[delete-account] PostHog delete failed for ${user.id}:`,
      err instanceof Error ? err.message : err
    );
  }

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`[delete-account] Supabase delete failed for ${user.id}:`, error.message);
    return NextResponse.json(
      { error: "Couldn't delete your account. Please email privacy@livealign.co." },
      { status: 500 }
    );
  }

  if (postHogByHand) {
    try {
      await sendPostHogDeleteReminder(user.id);
    } catch (err) {
      console.error(
        `[delete-account] PostHog reminder email failed; delete ${user.id} from PostHog by hand:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Clear the sign-in cookies. The user no longer exists, so ignore errors.
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
