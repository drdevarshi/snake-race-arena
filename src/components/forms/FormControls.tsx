"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full rounded-xl border bg-arena-black/70 px-4 py-3 text-base text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

/** Labelled input with hint + translated error. Errors are i18n keys. */
export function TextField({ label, name, error, hint, className, ...rest }: FieldProps) {
  const { t } = useT();
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold uppercase tracking-wide text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(
          inputBase,
          error
            ? "border-red-500/70 focus:ring-red-500/50"
            : "border-arena-border focus:border-neon-cyan focus:ring-neon-cyan/40",
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm font-semibold text-red-400">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type">) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextField {...props} type={visible ? "text" : "password"} className={cn("[&_input]:pr-20", props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="focus-ring absolute right-2 top-[34px] rounded-lg px-2 py-1.5 text-xs font-bold uppercase text-neon-cyan hover:bg-neon-cyan/10"
        aria-label={visible ? t("auth.fields.hidePassword") : t("auth.fields.showPassword")}
      >
        {visible ? t("auth.fields.hide") : t("auth.fields.show")}
      </button>
    </div>
  );
}

export function Checkbox({ name, label, error }: { name: string; label: ReactNode; error?: string }) {
  const { t } = useT();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
        <input
          id={id}
          type="checkbox"
          name={name}
          aria-invalid={!!error}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-arena-border bg-arena-black accent-neon-green"
        />
        <span>{label}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-red-400">
          {t(error)}
        </p>
      )}
    </div>
  );
}

/** Submit button that shows a pending label and disables itself while the action runs. */
export function SubmitButton({ label, pendingLabel, variant = "green" }: { label: string; pendingLabel: string; variant?: "green" | "purple" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-display font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-70",
        variant === "green"
          ? "bg-gradient-to-b from-neon-lime to-neon-green text-arena-black shadow-glow-green hover:brightness-110"
          : "bg-gradient-to-b from-neon-magenta to-neon-purple text-white shadow-glow-purple hover:brightness-110",
      )}
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Form-level message; `message` is an i18n key. */
export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "success" | "info" }) {
  const { t } = useT();
  if (!message) return null;
  const styles = {
    error: "border-red-500/50 bg-red-500/10 text-red-300",
    success: "border-neon-green/50 bg-neon-green/10 text-neon-green",
    info: "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", styles)}>
      {t(message)}
    </div>
  );
}
