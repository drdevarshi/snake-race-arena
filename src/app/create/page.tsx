import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Create Your Own Game" };

export default function CreatePage() {
  return <ComingSoon title={getT()("nav.create")} phase="Phase 4" />;
}
