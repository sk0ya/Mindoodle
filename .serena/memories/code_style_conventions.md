# Code Style and Conventions

## TypeScript Configuration
- **Strict mode enabled** with comprehensive type checking
- **Avoid unsafe patterns**: `any`, non-null assertions (`!`), unchecked type casts
- Use `npm run scan:unsafe` to detect unsafe patterns
- Path mapping configured for clean imports

## Path Aliases
- `@` → `src/`
- `@shared` → `src/shared/`
- `@local` → `src/Local/` (legacy, may exist in some configs)

## ESLint Rules
- Warns on `@typescript-eslint/no-explicit-any`
- Strict React hooks rules (`react-hooks/rules-of-hooks`, `exhaustive-deps`)
- Unused variable warnings (prefix with `_` to ignore)
- TypeScript handles `no-undef`, so it's disabled in ESLint

## Architecture Patterns
- **Modular exports**: All features re-export through `src/app/index.ts`
- **Hook-based core**: State management and business logic in `src/app/core/hooks/`
- **Feature-based organization**: Each feature has its own directory with components, hooks, types
- **Local-first**: No network calls, all data stored locally

## File Organization
- Place tests as `*.test.ts(x)` alongside source files (future)
- Use feature-based directory structure
- All main modules re-export through index.ts files