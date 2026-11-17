import { z } from "zod";

/** Error messages are i18n keys under "auth.errors.*" so the UI can translate them. */

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "auth.errors.usernameLength")
  .max(20, "auth.errors.usernameLength")
  .regex(/^[A-Za-z0-9_]+$/, "auth.errors.usernameChars");

export const emailSchema = z.string().trim().toLowerCase().max(254, "auth.errors.emailInvalid").email("auth.errors.emailInvalid");

export const passwordSchema = z
  .string()
  .min(8, "auth.errors.passwordLength")
  .max(72, "auth.errors.passwordLength")
  .regex(/[A-Za-z]/, "auth.errors.passwordStrength")
  .regex(/[0-9]/, "auth.errors.passwordStrength");

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { message: "auth.errors.acceptTerms" }),
    ref: z.string().max(64).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.errors.passwordMismatch",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "auth.errors.passwordRequired"),
  next: z.string().optional(),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.errors.passwordMismatch",
  });

export type FieldErrors = Partial<Record<string, string>>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Normalize referral source from promo links (?ref=instagram). */
export function normalizeReferral(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  const clean = ref.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  return clean || undefined;
}
