import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Supabase client for Server Components, Server Actions and Route Handlers (acts as the signed-in user, RLS applies). */
export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there. Middleware refreshes the session instead.
        }
      },
    },
  });
}
