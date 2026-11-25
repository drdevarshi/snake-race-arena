# Snake Race Arena — Project Instructions

## Project overview
Snake Race Arena is a free-to-play competitive snake racing platform. The current stack is Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion, HTML5 Canvas, Vitest, and Supabase.

Before changing code, inspect the relevant files and follow existing patterns. The README is the source of truth for current architecture and project setup. Do not assume future phases are already implemented.

## Git and pull requests
- Never commit or push directly to `main`. Create a focused feature or fix branch from the latest `main`.
- Keep changes small and scoped to the requested task.
- Open a pull request against `main`; explain the change, reasoning, tests, risks, and any follow-up work.
- Do not merge a pull request. The repository owner makes the final merge decision after CI and independent review.
- Do not disable, bypass, or weaken branch rules, CI checks, or security controls.
- Do not rewrite shared history or force-push unless the owner explicitly requests it.

## Required validation
For code changes, run the relevant checks before opening or updating a PR:
- `npm run typecheck`
- `npm test`
- `npm run build`

If a check cannot run, say exactly which one and why. Never claim a check passed unless it actually completed successfully. Update or add tests for behavior changes and bug fixes.

## Architecture and implementation rules
- Use the Next.js App Router conventions already present in `src/app/`.
- Keep TypeScript types explicit and preserve existing component and server/client boundaries.
- Keep the core game engine in `src/game/` pure and deterministic: no browser APIs, wall-clock time, or unseeded randomness. Preserve replay determinism and integer-based simulation rules.
- Treat all browser-submitted game results and times as untrusted. Server-side code must validate/replay inputs before ranking or awarding progress.
- Follow the existing Supabase server/client separation in `src/lib/supabase/`. Never expose the service-role key to client code. Database permissions and RLS are security boundaries; do not weaken them to make a feature work.
- Validate untrusted input at server boundaries (use the project's existing Zod patterns where appropriate).
- User-facing text must use the existing i18n system. Do not hardcode new UI copy; update the English dictionary and preserve translation keys/placeholders.
- Reuse the existing design tokens and UI patterns. Keep the game's neon visual identity consistent and ensure responsive/touch behavior where relevant.
- Keep the platform free-to-play: no paid entry, cash prizes, or transferable/cash-value Snake Coins.

## Security and privacy
- Never commit secrets, API keys, tokens, credentials, private user data, or populated environment files. Use `.env.example` for documented variable names only.
- Do not log passwords, authentication tokens, service-role credentials, or sensitive personal data.
- Review authorization on both server and database layers for protected actions. Do not rely only on hiding UI or middleware.
- Avoid adding dependencies unless necessary; explain new dependencies in the PR.

## Working with AI
- Be explicit about assumptions and unknowns. Do not invent existing APIs, scripts, environment variables, or completed functionality.
- Do not silently expand scope, change product rules, or remove existing behavior.
- Summarize changed files and test results in every PR.
- A separate reviewer must inspect the diff. The author must address review findings; the repository owner decides whether to merge.
