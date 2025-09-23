# Architecture Guidelines

## Directory Structure Organization

### 1. Shared vs Feature-Specific Utilities

#### Shared Utilities (`src/app/shared/utils/`)
**Use for**: Domain-agnostic, reusable utilities that could be used across multiple features

**Examples**:
- `idGenerator.ts` - Generic ID generation
- `arrayUtils.ts` - Generic array operations
- `stringUtils.ts` - Generic string operations
- `logger.ts` - Application-wide logging
- `validation.ts` - Generic validation functions
- `clipboard.ts` - Browser clipboard operations
- `eventUtils.ts` - Generic DOM event handling

**Guidelines**:
- Should have **zero** dependencies on feature-specific types
- Should be testable in isolation
- Should follow pure function principles where possible
- Should be generic enough to be useful in multiple contexts

#### Feature-Specific Utilities (`src/app/features/{feature}/utils/`)
**Use for**: Domain-specific utilities that operate on feature-specific data types

**Examples**:
- `mindmap/utils/nodeUtils.ts` - MindMap node operations
- `mindmap/utils/canvasCoordinateUtils.ts` - Canvas positioning logic
- `mindmap/utils/linkUtils.ts` - MindMap link operations
- `markdown/utils/` - Markdown-specific processing

**Guidelines**:
- Can import and depend on feature-specific types
- Should be focused on single feature domain
- Can import from `@shared/utils` for generic operations
- Should not be imported by other features directly

### 2. Hooks Organization

#### Shared Hooks (`src/app/shared/hooks/`)
Organized by category:

- **`ui/`** - UI interaction hooks (modals, drag & drop, boolean states)
- **`data/`** - Data management hooks (loading, cleanup, reset)
- **`system/`** - System-level hooks (error handling, initialization)
- **`network/`** - Network-related hooks (connection testing)

#### Feature-Specific Hooks (`src/app/features/{feature}/hooks/`)
- Domain-specific hooks that use feature types
- Can import from shared hooks for composition
- Should not be used outside their feature domain

### 3. Styles Organization

#### Centralized Styles (`src/app/shared/styles/`)
- **`layout/`** - Layout component styles (sidebars, main areas)
- **`ui/`** - UI component styles (buttons, inputs, modals)
- **`components/`** - Shared component styles

#### Benefits:
- Single source of truth for styles
- Easier maintenance and theme management
- Clear import paths using `@shared/styles/`
- Better organization than scattered CSS files

### 4. Component Organization

#### Shared Components (`src/app/shared/components/`)
- Truly generic, reusable UI components
- No business logic dependencies
- Can be used across multiple features

#### Feature Components (`src/app/features/{feature}/components/`)
- Business logic-specific components
- Can import shared components for composition
- Organized by subdomain (Canvas, Node, UI, Layout, etc.)

### 5. Type Organization

#### Shared Types (`src/app/shared/types/`)
- Core business entities (MindMapNode, MindMapData)
- Generic utility types
- Common interface definitions

#### Feature Types (`src/app/features/{feature}/types/`)
- Feature-specific interfaces
- Store state types
- Component prop types

### 6. Markdown Functionality Boundaries

#### Core Streams (`src/app/core/streams/`)
- **Reserved for**: Infrastructure-level data streaming
- **Currently**: Empty (MarkdownStream moved to features)

#### Features Markdown (`src/app/features/markdown/`)
- **Purpose**: Business logic for markdown processing
- **Includes**: Import/export, parsing, UI components, hooks
- **Services**: MarkdownStream (business-level data handling)

## Decision Rules

### When to put something in `shared/`:
1. **Zero feature dependencies** - Can be used without knowing about MindMaps, AI, etc.
2. **Multiple use cases** - Could reasonably be used by 2+ features
3. **Generic nature** - Solves a general programming problem, not domain-specific

### When to put something in `features/{feature}/`:
1. **Feature-specific types** - Uses MindMapNode, AI types, etc.
2. **Business logic** - Implements domain rules and workflows
3. **Single feature scope** - Only makes sense in one feature context

### Import Guidelines:
- ✅ Features can import from `@shared`
- ✅ Features can import from their own utils/hooks/components
- ❌ Features should NOT import from other features directly
- ❌ Shared should NOT import from features
- ✅ Use path aliases: `@shared`, `@core`, `@mindmap`, etc.

## Examples of Good Organization

### Good Shared Utility:
```typescript
// @shared/utils/arrayUtils.ts
export function removeItemById<T extends { id: string }>(
  array: T[],
  id: string
): T[] {
  return array.filter(item => item.id !== id);
}
```

### Good Feature-Specific Utility:
```typescript
// @mindmap/utils/nodeUtils.ts
import type { MindMapNode } from '@shared/types';
import { removeItemById } from '@shared/utils';

export function removeNodeById(nodes: MindMapNode[], id: string): MindMapNode[] {
  return removeItemById(nodes, id);
}
```

This organization ensures:
- Clear boundaries between generic and domain-specific code
- Easy maintenance and testing
- Consistent import patterns
- Scalable architecture as features grow