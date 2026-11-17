import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return <ComingSoon title={getT()("nav.login")} phase="Phase 2" />;
}
