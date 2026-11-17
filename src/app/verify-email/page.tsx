import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { emailSchema } from "@/lib/auth/validation";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; error?: string }> }) {
  const { email, error } = await searchParams;
  const parsed = emailSchema.safeParse(email ?? "");
  return <VerifyEmailPanel email={parsed.success ? parsed.data : undefined} error={error} />;
}
