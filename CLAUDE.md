# CLAUDE.md

Quick guide and safety rails for Claude Code in this repository. Use this section for day-to-day work; deep references live under docs/.

## At a Glance

- Work under `frontend/` (React + TypeScript + Vite).
- Run commands from `frontend/`; validate with build, lint, type-check, unsafe scan.
- Respect path aliases: `@` → `src`, `@shared` → `src/app/shared`, `@local` if present.
- Keep exports aggregated via `src/app/index.ts`; avoid deep imports.
- Local-first: do not add network calls or external APIs without discussion.
- Vite `base` is `/Mindoodle/`; keep public assets in `frontend/public/`.

## Common Commands (frontend/)

- `npm run dev` — start dev server (5174).
- `npm run build` — type-safety gate + production build to `dist/`.
- `npm run preview` — preview production build.
- `npm run type-check` / `type-check:strict` — TS checks (no emit).
- `npm run lint` / `lint:fix` — ESLint for `src/**/*.{ts,tsx,js,jsx}`.
- `npm run scan:unsafe` — detect `any`, `!`, unchecked `JSON.parse`.
- `npm run validate` — consolidated type-safety validation.

## Minimal Workflow (Claude)

- Read only necessary files (≤250 lines per view).
- Maintain a short plan with `update_plan`; keep one step in progress.
- Patch surgically; keep changes minimal and scoped.
- Validate: build, type-check, lint, scan:unsafe.
- Summarize changes and propose clear next steps.

## Coding Standards

- TypeScript strict mode. Avoid `any`, non-null `!`, unchecked casts.
- 2-space indent; ES modules; React function components.
- Names: PascalCase components; camelCase vars/functions.
- Keep logic in services/hooks; keep components lean.
- Import via `@/...` and `@shared/...`; aggregate via `src/app/index.ts`.

## Do / Don’t

- Do validate inputs; avoid raw `JSON.parse` without guards.
- Do keep exports aggregated via `src/app/index.ts`.
- Do preserve local-first behavior (no new network calls).
- Don’t change Vite `base` or public asset locations.
- Don’t bypass types with `any`/`!`.

## Deep Reference

- Architecture overview: see `docs/ARCHITECTURE.md`.
- Roadmap and refactoring: see `docs/ROADMAP.md`.
- 構造再設計（分岐削減）計画: see `docs/RESTRUCTURE.md`.

