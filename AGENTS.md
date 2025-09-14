# Repository Guidelines

## Project Structure & Module Organization
- Root app lives in `frontend/` (Vite + React + TypeScript).
- Source: `frontend/src/`
  - App entry: `src/main.tsx`, `src/App.tsx`
  - Modular app: `src/app/{core,features,components,shared,types}` with re-exports in `src/app/index.ts`.
  - Shared utilities/components: `src/shared/**`
- Static assets: `frontend/public/` (served at root). Build output: `frontend/dist/`.
- Tooling/config: `frontend/{package.json, vite.config.js, eslint.config.js, tsconfig*.json}`.
- Path aliases (Vite/TS): `@` → `src`, plus `@shared`, `@local`, `@cloud`.

## Build, Test, and Development Commands
- Always run inside `frontend/`.
  - `npm run dev` — start Vite dev server on port 5174.
  - `npm run build` — type-safety gate then production build to `dist/`.
  - `npm run preview` — preview the production build.
  - `npm run type-check` / `type-check:strict` — TypeScript checks (no emit).
  - `npm run lint` / `lint:fix` — ESLint for `src/**/*.{ts,tsx,js,jsx}`.
  - `npm run scan:unsafe` — scan TS files for unsafe patterns (any, non‑null `!`, unchecked JSON.parse).

## Coding Style & Naming Conventions
- TypeScript strict mode is enabled; avoid `any`, non‑null `!`, and unchecked casts.
- Indentation: 2 spaces; ES modules; React function components.
- Naming: PascalCase for React components (`MindMapApp.tsx`), camelCase for vars/functions, kebab-case not required for files; directories are lowercase.
- Respect path aliases and keep exports aggregated via `src/app/index.ts`.
- Linting: ESLint with `@typescript-eslint`, `react`, `react-hooks`. Fix warnings before opening PRs.

## Testing Guidelines
- No unit test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Place tests alongside code as `*.test.ts(x)`. Keep components pure/deterministic and avoid real timers or network.

## Commit & Pull Request Guidelines
- Follow Conventional Commits style seen in history: `feat:`, `fix:`, `refactor:`, `perf:`, `chore:`, `revert:` with optional scope, e.g., `fix(map-select): ensure onSelectMap path`.
- PRs must include: clear description, linked issues, before/after screenshots for UI, and a checklist confirming `build`, `lint`, `type-check`, and `scan:unsafe` pass.

## Security & Configuration Tips
- App is local-first; do not add network calls without discussion.
- `vite.config.js` sets `base: '/Mindoodle/'` for static hosting; keep public assets under `public/`.
- Validate inputs; avoid raw `JSON.parse` without schema/guards.

