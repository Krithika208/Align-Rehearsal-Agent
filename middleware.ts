import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // The Stripe and Cal.com webhooks are excluded so nothing runs before the
    // handler reads the signed raw body. They have no user session anyway.
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cal/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
