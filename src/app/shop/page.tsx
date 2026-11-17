import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Hall of Fame & Rewards Shop" };

export default function ShopPage() {
  return <ComingSoon title={getT()("nav.rewards")} phase="Phase 6" />;
}
