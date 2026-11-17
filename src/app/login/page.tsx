import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/validation";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={next ? safeNextPath(next) : undefined}
      initialError={error ? "auth.errors.generic" : undefined}
    />
  );
}
