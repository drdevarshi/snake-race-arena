import { RegisterForm } from "@/components/auth/RegisterForm";
import { normalizeReferral } from "@/lib/auth/validation";

export const metadata = { title: "Register" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <RegisterForm referral={normalizeReferral(ref)} />;
}
