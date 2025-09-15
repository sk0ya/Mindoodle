# Suggested Development Commands

All commands must be run from the `frontend/` directory.

## Development
- `npm run dev` — Start Vite development server on port 5174
- `npm run build` — Production build with validation (includes type-check)
- `npm run preview` — Preview production build locally

## Code Quality
- `npm run type-check` — TypeScript type checking without emit
- `npm run type-check:strict` — Strict TypeScript checking
- `npm run lint` — ESLint for source files
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run scan:unsafe` — Detect unsafe TypeScript patterns (any, !, unchecked JSON.parse)
- `npm run validate` — Type safety validation gate

## System Commands
- `git status` — Check git status
- `git log --oneline -10` — Recent commits
- `ls -la` — List files with details
- `find . -name "*.tsx" -o -name "*.ts"` — Find TypeScript files
- `grep -r "pattern" src/` — Search in source files

## Build Output
- Production builds output to `frontend/dist/`
- Base path configured for `/Mindoodle/` static hosting