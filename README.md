# Snake Race Arena

**PLAY. COMPETE. CONQUER.** A free-to-play competitive Snake racing platform.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · HTML5 Canvas · Supabase (from Phase 2) · Vercel.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, theme, i18n, navigation, landing page | ✅ Done |
| 2 | Supabase schema + RLS, register/login, email verification, password reset, roles, player dashboard | ✅ Done |
| 3 | Snake engine (Canvas, deterministic courses, water/tunnels, power-ups, touch controls) | ⏳ Next |
| 4 | Competitions (public/private), invite codes, attempt log, server-side replay validation | |
| 5 | Leaderboards, results, podium, history | |
| 6 | Snake Coins ledger, rewards shop, inventory | |
| 7 | Spin the Wheel, claim codes, referral tracking | |
| 8 | Admin + organizer dashboards, audit logs, rate limiting, deployment | |

Routes that are not built yet show a "Coming soon" page, so every link works.

## Run locally

Requirements: Node.js 18.18+ (20 or 22 recommended).

```bash
npm install
cp .env.example .env.local   # values aren't needed until Phase 2
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## Supabase setup (Phase 2)

The site runs without Supabase, but login and registration show "not configured" until you finish these steps.

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Copy the keys** from Project Settings → API into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` comes from the Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the `anon` / publishable key.
   - `SUPABASE_SERVICE_ROLE_KEY` is the `service_role` / secret key. It's server-only, so never share it or commit it.
3. **Run the database migration.** Go to SQL Editor → New query, paste all of `supabase/migrations/0001_auth_profiles.sql` and click Run. It's safe to run more than once.
4. **Configure auth** under Authentication:
   - Under Sign In / Providers → Email, make sure **Confirm email** is ON.
   - Under URL Configuration, set the Site URL to `http://localhost:3000` (your Vercel URL later). Add `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` to Redirect URLs.
   - Under Email Templates → **Confirm signup**, replace the link with the one below. It makes verification work even when the email is opened on a different device:
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Verify my email</a>
     ```
   - Under Email Templates → **Reset password**:
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset my password</a>
     ```
   - Supabase's built-in email sender is heavily rate-limited (a few emails per hour). Before launch, add your own SMTP server under Project Settings → Authentication → SMTP.
5. **Restart** `npm run dev`. Environment variables are only read at startup.

### Making yourself an admin

Admins can never be created through the website. Register normally, verify your email, then run this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where username = 'YourUsername';
```

### Security model

| Data | Who can read | Who can change |
|---|---|---|
| Profile (username, colour, level) | Everyone (needed for leaderboards) | Owner: display name, avatar colour and language only |
| Role, coins, XP, suspension | Everyone | Server functions only. Players are blocked at the database level. |
| Audit log | Admins | Nobody directly. It's written by server functions. |

- The role is always forced to `player` at signup, even if someone tampers with the request.
- Usernames are unique regardless of capitalisation. Reserved names such as `admin` and `support` are blocked.
- Login, registration and password reset never reveal whether an email already has an account.
- `?next=` redirects only allow paths on this site, which blocks open-redirect attacks.
- Auth rate limits are enforced by Supabase. App-level rate limiting comes in Phase 8.
- Protected routes (`/dashboard`, `/inventory`, `/create`, `/organizer`, `/admin`) are checked twice: once in middleware and again in each page. `/admin` also requires the admin role.

## Project structure

```
src/
  app/                    Routes (App Router)
    layout.tsx            Root layout: fonts, I18nProvider, Navbar, Footer
    page.tsx              Landing page
    globals.css           Tailwind layers + neon utilities
    not-found.tsx         404 page
    arena|create|leaderboard|login|register|shop|spin/   Placeholder routes
  components/
    brand/SnakeLogo.tsx   Original SVG logo mark
    layout/               Navbar (responsive + mobile menu), Footer
    home/                 Hero, HeroSnakeCanvas (attract-mode preview), landing sections
    ui/                   NeonButton/NeonLink, GlowCard, Icons, ComingSoon
  config/                 Navigation items, default reward amounts
  i18n/
    config.ts             Supported locales
    messages/en.json      All user-facing text
    translate.ts          getT() for server components
    I18nProvider.tsx      useT() hook for client components
    auth/                 Register, login, verify-email, password forms
    forms/                TextField, PasswordField, SubmitButton, FormMessage, AuthCard
    dashboard/            Avatar
  lib/
    supabase/             server.ts (user client), admin.ts (service role), middleware.ts, env.ts
    auth/                 actions.ts (server actions), validation.ts (zod), session.ts (getSession/requireUser/requireAdmin)
    game/progression.ts   XP → level curve
  middleware.ts           Session refresh + route guards
  app/auth/confirm/       Email link handler (verify + password recovery)
  app/dashboard/          Player dashboard
supabase/migrations/      SQL migrations (run in order)
```

Planned additions: `src/game/` (pure engine shared by browser and server validator).

## Translations

No user-facing text is hardcoded. To add a language:

1. Copy `src/i18n/messages/en.json` to e.g. `es.json` and translate the values (keep the keys).
2. Import it in `src/i18n/translate.ts` and add it to `dictionaries`.
3. Add the code to `locales` in `src/i18n/config.ts`.

Use `t("home.hero.title1")` in components, and `{name}` placeholders for variables.

## Design tokens

Colors are in `tailwind.config.ts` under `arena.*` (backgrounds) and `neon.*` (green, lime, blue, cyan, purple, magenta, gold), with matching `shadow-glow-*` utilities. Fonts are Orbitron (display) and Rajdhani (body), loaded from Google Fonts in `layout.tsx`.

## Deploying (preview)

1. Push this folder to a new GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repo and keep the defaults (Next.js is detected automatically).
3. In Project Settings → Environment Variables, add `NEXT_PUBLIC_SITE_URL` (your Vercel URL), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
4. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel URL and add it to Redirect URLs.

## Rules carried into later phases

- Free competitions only: no paid entry, no cash prizes. Snake Coins have no cash value and are non-transferable.
- Times submitted by the browser are never trusted. The server re-simulates every run from its input log.
- Admin accounts are never created through public registration.
