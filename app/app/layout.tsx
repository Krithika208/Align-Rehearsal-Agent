import { requireActiveSubscription } from "@/lib/subscription";

// Gates every /app route behind an active/trialing subscription. The check
// runs server-side and redirects before any UI renders, so there's no flicker.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveSubscription();
  return <>{children}</>;
}
