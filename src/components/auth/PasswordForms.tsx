"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction, type ActionState } from "@/lib/auth/actions";
import { useT } from "@/i18n/I18nProvider";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/forms/FormControls";
import { AuthCard } from "@/components/forms/AuthCard";

export function ForgotPasswordForm() {
  const { t } = useT();
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction, {});
  return (
    <AuthCard
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={
        <Link href="/login" className="focus-ring rounded font-bold text-neon-cyan hover:underline">
          {t("auth.forgot.back")}
        </Link>
      }
    >
      {state.ok ? (
        <FormMessage tone="success" message={state.message} />
      ) : (
        <form action={action} noValidate className="space-y-4">
          <FormMessage message={state.message} />
          <TextField
            label={t("auth.fields.email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
          <SubmitButton label={t("auth.forgot.submit")} pendingLabel={t("auth.forgot.submitting")} />
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const { t } = useT();
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <AuthCard title={t("auth.reset.title")}>
      <form action={action} noValidate className="space-y-4">
        <FormMessage message={state.message} />
        <PasswordField
          label={t("auth.fields.newPassword")}
          name="password"
          autoComplete="new-password"
          required
          hint={t("auth.fields.passwordHint")}
          error={fe.password}
        />
        <PasswordField
          label={t("auth.fields.confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          required
          error={fe.confirmPassword}
        />
        <SubmitButton label={t("auth.reset.submit")} pendingLabel={t("auth.reset.submitting")} />
      </form>
    </AuthCard>
  );
}
