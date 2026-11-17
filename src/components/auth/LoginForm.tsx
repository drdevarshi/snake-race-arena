"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { useT } from "@/i18n/I18nProvider";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/forms/FormControls";
import { AuthCard } from "@/components/forms/AuthCard";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const { t } = useT();
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {
    message: initialError,
  });
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link href="/register" className="focus-ring rounded font-bold text-neon-green hover:underline">
            {t("auth.login.registerLink")}
          </Link>
        </>
      }
    >
      <form action={action} noValidate className="space-y-4">
        <FormMessage message={state.message} />
        <input type="hidden" name="next" value={v.next || next || ""} />
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
          autoComplete="current-password"
          required
          error={fe.password}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="focus-ring rounded text-sm font-semibold text-neon-cyan hover:underline">
            {t("auth.login.forgot")}
          </Link>
        </div>
        <SubmitButton label={t("auth.login.submit")} pendingLabel={t("auth.login.submitting")} />
      </form>
    </AuthCard>
  );
}
