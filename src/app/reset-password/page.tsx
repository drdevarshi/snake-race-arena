import { ResetPasswordForm } from "@/components/auth/PasswordForms";

export const metadata = { title: "Choose a new password" };

// Reached via the recovery link (/auth/confirm signs the user in first).
// The action itself rejects the request if there is no valid recovery session.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
