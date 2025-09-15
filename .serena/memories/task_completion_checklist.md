# Task Completion Checklist

## Before Completing Any Task
1. **Type Check**: `npm run type-check` (from frontend/ directory)
2. **Lint Check**: `npm run lint` 
3. **Unsafe Pattern Scan**: `npm run scan:unsafe`
4. **Build Test**: `npm run build` (includes validation)

## Code Quality Gates
- All builds must pass type-check, lint, and unsafe pattern scan
- No `any` types, non-null assertions (`!`), or unchecked type casts
- Follow React hooks rules strictly
- Maintain modular architecture patterns

## Git Workflow
- Check `git status` before and after changes
- Use descriptive commit messages
- Work on feature branches, not main

## Testing (Future)
- No test framework currently configured
- Consider Vitest + React Testing Library for future tests
- Tests should be placed as `*.test.ts(x)` alongside source files

## Validation Commands (All from frontend/ directory)
```bash
npm run type-check
npm run lint
npm run scan:unsafe
npm run build
```