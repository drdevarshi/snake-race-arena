"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type ActionState } from "@/lib/auth/actions";
import { useT } from "@/i18n/I18nProvider";
import { Checkbox, FormMessage, PasswordField, SubmitButton, TextField } from "@/components/forms/FormControls";
import { AuthCard } from "@/components/forms/AuthCard";

export function RegisterForm({ referral }: { referral?: string }) {
  const { t } = useT();
  const [state, action] = useActionState<ActionState, FormData>(registerAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <AuthCard
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link href="/login" className="focus-ring rounded font-bold text-neon-cyan hover:underline">
            {t("auth.register.loginLink")}
          </Link>
        </>
      }
    >
      {referral && (
        <p role="status" className="mb-4 rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 px-4 py-3 text-sm font-semibold text-neon-cyan">
          {t("auth.register.referred", { source: referral })}
        </p>
      )}
      <form action={action} noValidate className="space-y-4">
        <FormMessage message={state.message} />
        <input type="hidden" name="ref" value={v.ref || referral || ""} />
        <TextField
          label={t("auth.fields.username")}
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          defaultValue={v.username}
          hint={t("auth.fields.usernameHint")}
          error={fe.username}
        />
        <TextField
          label={t("auth.fields.email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={v.email}
          error={fe.email}
        />
        <PasswordField
          label={t("auth.fields.password")}
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
        <Checkbox name="acceptTerms" label={t("auth.fields.acceptTerms")} error={fe.acceptTerms} />
        <SubmitButton label={t("auth.register.submit")} pendingLabel={t("auth.register.submitting")} />
      </form>
    </AuthCard>
  );
}
