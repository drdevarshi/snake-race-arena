import { ComingSoon } from "@/components/ui/ComingSoon";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/i18n/translate";

export const metadata = { title: "My Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireUser("/inventory");
  return <ComingSoon title={getT()("dashboard.quick.inventory")} phase="Phase 6" />;
}
