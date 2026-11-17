"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getSupabaseEnv } from "@/lib/supabase/env";
import {
  emailOnlySchema,
  loginSchema,
  newPasswordSchema,
  normalizeReferral,
  registerSchema,
  safeNextPath,
  toFieldErrors,
  type FieldErrors,
} from "./validation";

export interface ActionState {
  ok?: boolean;
  /** i18n key for a form-level message */
  message?: string;
  fieldErrors?: FieldErrors;
  /** echo back non-secret values so the form keeps them after an error */
  values?: Record<string, string>;
}

const NOT_CONFIGURED: ActionState = { message: "auth.errors.notConfigured" };

function formValues(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
}

/** Map Supabase auth errors to i18n keys without leaking whether an account exists. */
function mapAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("username_unavailable") || m.includes("database error saving new user")) return "auth.errors.usernameTaken";
  if (m.includes("rate limit") || m.includes("too many")) return "auth.errors.rateLimited";
  if (m.includes("email not confirmed")) return "auth.errors.emailNotConfirmed";
  if (m.includes("invalid login credentials")) return "auth.errors.invalidCredentials";
  if (m.includes("password")) return "auth.errors.passwordStrength";
  return "auth.errors.generic";
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["username", "email", "ref"]);
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values };

  const parsed = registerSchema.safeParse({
    username: fd.get("username"),
    email: fd.get("email"),
    password: fd.get("password"),
    confirmPassword: fd.get("confirmPassword"),
    acceptTerms: fd.get("acceptTerms") ?? undefined,
    ref: fd.get("ref") || undefined,
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const { username, email, password, ref } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: available, error: rpcError } = await supabase.rpc("username_available", { p_username: username });
  if (rpcError) return { message: "auth.errors.generic", values };
  if (!available) return { fieldErrors: { username: "auth.errors.usernameTaken" }, values };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Role is NOT accepted from here — the database trigger always creates 'player'.
      data: { username, referral_source: normalizeReferral(ref) },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) {
    const key = mapAuthError(error.message);
    return key === "auth.errors.usernameTaken"
      ? { fieldErrors: { username: key }, values }
      : { message: key, values };
  }

  // Same response whether or not the email already had an account (prevents account enumeration).
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["email", "next"]);
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values };

  const parsed = loginSchema.safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
    next: fd.get("next") || undefined,
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const key = mapAuthError(error.message);
    if (key === "auth.errors.emailNotConfirmed") {
      redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return { message: key, values };
  }

  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  if (getSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendVerificationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!getSupabaseEnv()) return NOT_CONFIGURED;
  const parsed = emailOnlySchema.safeParse({ email: fd.get("email") });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/dashboard` },
  });
  if (error && mapAuthError(error.message) === "auth.errors.rateLimited") {
    return { message: "auth.errors.rateLimited" };
  }
  // Always report success to avoid revealing whether the email exists.
  return { ok: true, message: "auth.verify.resent" };
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["email"]);
  if (!getSupabaseEnv()) return { ...NOT_CONFIGURED, values };
  const parsed = emailOnlySchema.safeParse({ email: fd.get("email") });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error && mapAuthError(error.message) === "auth.errors.rateLimited") {
    return { message: "auth.errors.rateLimited", values };
  }
  return { ok: true, message: "auth.forgot.sent" };
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!getSupabaseEnv()) return NOT_CONFIGURED;
  const parsed = newPasswordSchema.safeParse({
    password: fd.get("password"),
    confirmPassword: fd.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "auth.errors.resetLinkExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: mapAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/dashboard?reset=1");
}
