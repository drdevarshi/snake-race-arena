import { ComingSoon } from "@/components/ui/ComingSoon";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <ComingSoon title={getT()("nav.leaderboard")} phase="Phase 5" />;
}
