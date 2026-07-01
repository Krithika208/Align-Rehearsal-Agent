import { requireActiveSubscription } from "@/lib/subscription";

// The rehearsal history/detail pages are part of the paid app experience, so
// they carry the same subscription gate as /app.
export default async function RehearsalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveSubscription();
  return <>{children}</>;
}
