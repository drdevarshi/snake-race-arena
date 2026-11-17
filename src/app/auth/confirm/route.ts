import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/auth/validation";

/**
 * Handles links from Supabase emails (signup confirmation, password recovery).
 * Supports both formats:
 *   - token_hash + type  (recommended email template; works across devices)
 *   - code               (default PKCE link; must be opened in the same browser)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(`${origin}/verify-email?error=${reason}`);

  if (!getSupabaseEnv()) return fail("not_configured");
  const supabase = await createSupabaseServerClient();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("link_invalid");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link_invalid");
  } else {
    return fail("link_invalid");
  }

  const dest = type === "recovery" ? "/reset-password" : next;
  return NextResponse.redirect(`${origin}${dest}${dest === "/dashboard" ? "?verified=1" : ""}`);
}
