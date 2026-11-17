# Snake Race Arena

**PLAY. COMPETE. CONQUER.** A free-to-play competitive Snake racing platform.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · HTML5 Canvas · Supabase (from Phase 2) · Vercel.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, theme, i18n, navigation, landing page | ✅ Done |
| 2 | Supabase schema + RLS, register/login, email verification, password reset, roles, player dashboard | ✅ Done |
| 3 | Snake engine (Canvas, deterministic courses, water/tunnels, power-ups, touch controls) | ✅ Done |
| 4 | Competitions (public/private), invite codes, attempt log, server-side replay validation | ⏳ Next |
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

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm test` (game engine tests).

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

## The Snake game (Phase 3)

Play at `/play`. Practice is open to everyone, with no login. `/arena` lists the courses.

### How it works

`src/game/` is a **pure, deterministic engine** with no browser code. It contains no randomness and no clocks, and all of its maths uses whole numbers.

- The simulation advances in fixed **20 ms ticks**. The snake moves one cell every N ticks: slow = 8, normal = 6, fast = 5.
- A run is fully described by **course + speed + input log**. The input log is a list of `{ t: tick, d: "U"|"D"|"L"|"R" }` entries.
- `replay(course, speed, inputs)` re-simulates a run and returns the verified status, time and apples. In Phase 4 the server will call this to rank runs, and it will never accept a time from the browser.
- Replay is strict. It marks a log invalid if the inputs are out of order, include an impossible turn, come after the run ended, are malformed, or exceed 10 minutes.

### Rules implemented

| Rule | Behaviour |
|---|---|
| Fixed length | The snake never grows. Collect all apples (10 per course) to finish. |
| Water | Moves take 2× as long, unless Extra Energy is active. |
| Bridges | Cross water at full speed. |
| Tunnels | Numbered mouths. Entering one exits at its pair, keeping the same direction. |
| Crashes | Hitting a wall, rock or your own body ends the attempt. |
| Speed Boost | Moves 2 ticks faster for 3 s. |
| Safety Shield | Absorbs one crash. The snake then stalls safely for 0.4 s so you can turn. |
| Apple Magnet | Collects apples within 2 cells for 5 s. |
| Extra Energy | Full speed in water for 6 s. |
| Fairness | Power-ups sit at fixed positions on the course, the same for everyone. Competitions lock the speed setting. |

### Controls

Steer with the arrow keys or WASD. Space, P or Esc pauses, R restarts and Enter starts. On touch screens, swipe on the board or use the on-screen pad. The game auto-pauses when you switch tabs. Sound effects and music are generated in the browser, so there are no audio files to download.

### Adding a course

Courses live in `src/game/courses/index.ts` and are drawn with `CourseBuilder` (`rect`, `border`, `replace`, `set`). In the ASCII legend:

- `.` ground, `#` rock, `~` water, `=` bridge
- `S` start, `@` apple, `1`–`9` tunnel pairs
- `B` boost, `H` shield, `M` magnet, `E` energy

Run `npm test` after adding a course. A bot plays every course start to finish and checks that a replay reproduces the exact time. The tests fail if any apple is unreachable.

## Project structure

```
src/
  app/                      Routes (App Router)
    layout.tsx              Root layout: fonts, I18nProvider, Navbar (auth-aware), Footer
    page.tsx                Landing page
    arena/  play/           Course list · gameplay
    register/ login/ verify-email/ forgot-password/ reset-password/   Auth screens
    auth/confirm/route.ts   Email link handler (verify + password recovery)
    dashboard/ inventory/ admin/                                      Protected pages
    create/ leaderboard/ shop/ spin/                                  Placeholders (later phases)
  game/                     Pure deterministic engine (shared by browser + server)
    types.ts engine.ts replay.ts course.ts courses/ engine.test.ts
  components/
    game/                   GameClient, renderer (canvas), sound, TouchPad, CoursePreview
    auth/ forms/            Auth forms and reusable form controls
    home/ layout/ ui/ brand/ dashboard/
  lib/
    supabase/               server.ts (user client), admin.ts (service role), middleware.ts, env.ts
    auth/                   actions.ts (server actions), validation.ts (zod), session.ts
    game/progression.ts     XP → level curve
  i18n/                     config.ts, translate.ts (getT), I18nProvider.tsx (useT), messages/en.json
  config/                   Navigation, default reward amounts
  middleware.ts             Session refresh + route guards
supabase/migrations/        SQL migrations (run in order)
```

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
