import { ComingSoon } from "@/components/ui/ComingSoon";
import { requireAdmin } from "@/lib/auth/session";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin(); // non-admins are redirected to /dashboard
  return <ComingSoon title={getT()("dashboard.quick.admin")} phase="Phase 8" />;
}
