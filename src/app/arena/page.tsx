import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Game Arena" };

export default function ArenaPage() {
  return <ComingSoon title={getT()("nav.play")} phase="Phase 4" />;
}
