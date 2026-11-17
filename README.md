# Snake Race Arena

**PLAY. COMPETE. CONQUER.** A free-to-play competitive Snake racing platform.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · HTML5 Canvas · Supabase (from Phase 2) · Vercel.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, theme, i18n, navigation, landing page | ✅ Done |
| 2 | Supabase schema + RLS, register/login, email verification, roles, player dashboard | ⏳ Next |
| 3 | Snake engine (Canvas, deterministic courses, water/tunnels, power-ups, touch controls) | |
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
  lib/                    Small utilities
```

Planned additions: `src/game/` (pure engine shared by browser and server validator), `src/lib/supabase/`, `supabase/migrations/`.

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
3. Add `NEXT_PUBLIC_SITE_URL` in Project Settings → Environment Variables. The Supabase keys will be added in Phase 2.

## Rules carried into later phases

- Free competitions only: no paid entry, no cash prizes. Snake Coins have no cash value and are non-transferable.
- Times submitted by the browser are never trusted. The server re-simulates every run from its input log.
- Admin accounts are never created through public registration.
