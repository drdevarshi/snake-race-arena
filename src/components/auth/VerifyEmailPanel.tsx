"use client";

import { useActionState } from "react";
import { resendVerificationAction, type ActionState } from "@/lib/auth/actions";
import { useT } from "@/i18n/I18nProvider";
import { FormMessage, SubmitButton, TextField } from "@/components/forms/FormControls";
import { AuthCard } from "@/components/forms/AuthCard";
import { NeonLink } from "@/components/ui/NeonButton";

export function VerifyEmailPanel({ email, error }: { email?: string; error?: string }) {
  const { t } = useT();
  const [state, action] = useActionState<ActionState, FormData>(resendVerificationAction, {});

  const errorKey =
    error === "link_invalid" ? "auth.verify.linkInvalid" : error === "not_configured" ? "auth.verify.notConfigured" : undefined;

  return (
    <AuthCard title={t("auth.verify.title")}>
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-glow-cyan">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </div>

      <div className="space-y-4 text-center">
        {errorKey ? (
          <FormMessage message={errorKey} />
        ) : (
          <p className="text-slate-300">
            {email ? t("auth.verify.body", { email }) : t("auth.verify.bodyNoEmail")}
          </p>
        )}
        <p className="text-sm text-slate-500">{t("auth.verify.hint")}</p>
      </div>

      <form action={action} noValidate className="mt-6 space-y-3">
        <FormMessage message={state.message} tone={state.ok ? "success" : "error"} />
        {email ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <TextField label={t("auth.fields.email")} name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
        )}
        <SubmitButton label={t("auth.verify.resend")} pendingLabel={t("auth.verify.resending")} variant="purple" />
      </form>

      <div className="mt-4 text-center">
        <NeonLink href="/" variant="ghost" size="sm">
          {t("auth.verify.back")}
        </NeonLink>
      </div>
    </AuthCard>
  );
}
