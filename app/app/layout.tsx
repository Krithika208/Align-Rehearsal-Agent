import { requireAppAccess } from "@/lib/subscription";

// Gates every /app route: paid users, or free users with rehearsals left. The
// check runs server-side and redirects before any UI renders, so no flicker.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess();
  return <>{children}</>;
}
