import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Routes that require a signed-in, email-verified user. */
const PROTECTED_PREFIXES = ["/dashboard", "/inventory", "/create", "/organizer", "/admin"];
/** Routes a signed-in user shouldn't see. */
const GUEST_ONLY = ["/login", "/register"];

/** Refreshes the Supabase session cookie on every request and guards protected routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  if (!env) return response; // Not configured yet: let pages render their setup notice.

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() validates the JWT with Supabase; don't use getSession() for auth decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isProtected && user && !user.email_confirmed_at) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && GUEST_ONLY.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
