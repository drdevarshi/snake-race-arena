import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Register" };

export default function RegisterPage() {
  return <ComingSoon title={getT()("nav.register")} phase="Phase 2" />;
}
