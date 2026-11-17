import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Spin the Wheel" };

export default function SpinPage() {
  return <ComingSoon title={getT()("home.hero.ctaSecondary")} phase="Phase 7" />;
}
