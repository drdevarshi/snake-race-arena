import { ComingSoon } from "@/components/ui/ComingSoon";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/i18n/translate";

export const metadata = { title: "Create Your Own Game" };
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  // Second, server-side login check. Middleware also guards this route; this one
  // still holds if the middleware is ever skipped (defense in depth).
  await requireUser("/create");
  return <ComingSoon title={getT()("nav.create")} phase="Phase 4" />;
}
