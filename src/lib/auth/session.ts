import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type UserRole = "player" | "admin";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_color: string;
  locale: string;
  role: UserRole;
  coin_balance: number;
  xp: number;
  is_suspended: boolean;
  created_at: string;
}

export interface SessionInfo {
  userId: string;
  email: string;
  emailVerified: boolean;
  profile: Profile | null;
}

/** Current user + profile, deduplicated per request. Returns null when signed out or Supabase isn't configured. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  if (!getSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_color, locale, role, coin_balance, xp, is_suspended, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return {
    userId: user.id,
    email: user.email ?? "",
    emailVerified: !!user.email_confirmed_at,
    profile: profile ?? null,
  };
});

/** Use at the top of protected pages. Middleware also guards these routes; this is defense in depth. */
export async function requireUser(nextPath = "/dashboard"): Promise<SessionInfo & { profile: Profile }> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!session.emailVerified) redirect("/verify-email");
  if (!session.profile) redirect("/login?error=profile_missing");
  return session as SessionInfo & { profile: Profile };
}

export async function requireAdmin(): Promise<SessionInfo & { profile: Profile }> {
  const session = await requireUser("/admin");
  if (session.profile.role !== "admin") redirect("/dashboard");
  return session;
}
