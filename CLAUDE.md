# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**All commands must be run from the `frontend/` directory:**

- `npm run dev` — Start Vite development server on port 5174
- `npm run build` — Production build with validation (includes type-check)
- `npm run preview` — Preview production build locally
- `npm run type-check` — TypeScript type checking without emit
- `npm run type-check:strict` — Strict TypeScript checking
- `npm run lint` — ESLint for source files
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run scan:unsafe` — Detect unsafe TypeScript patterns (any, !, unchecked JSON.parse)
- `npm run validate` — Type safety validation gate

## Project Architecture

**Mindoodle** is a local-first, markdown-based mind mapping application built with React + TypeScript + Vite.

### Directory Structure

**Current Directory Structure:**
```
frontend/
├── public/                       # 静的ファイル（favicon, manifest, icons）
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── manifest.json
│   └── ...
├── src/
│   ├── app/                      # アプリケーションのコア（データ層・サービス）
│   │   ├── core/                 # コアアーキテクチャ
│   │   │   ├── commands/         # コマンドシステム
│   │   │   ├── data/             # データ管理
│   │   │   ├── hooks/            # コアHooks
│   │   │   ├── services/         # サービス層
│   │   │   ├── storage/          # ストレージ管理
│   │   │   ├── store/            # Zustand状態管理
│   │   │   ├── streams/          # データストリーム
│   │   │   └── utils/            # コアユーティリティ
│   │   │
│   │   ├── features/             # 機能単位（mindmap, etc.）
│   │   │   └── mindmap/
│   │   │       ├── components/
│   │   │       │   ├── Canvas/   # Canvas関連コンポーネント
│   │   │       │   │   ├── CanvasRenderer.tsx
│   │   │       │   │   ├── CanvasConnections.tsx
│   │   │       │   │   ├── CanvasDragGuide.tsx
│   │   │       │   │   ├── CanvasDragHandler.tsx
│   │   │       │   │   ├── CanvasEventHandler.ts
│   │   │       │   │   ├── CanvasViewportHandler.ts
│   │   │       │   │   └── index.ts
│   │   │       │   ├── Node/     # Node関連コンポーネント
│   │   │       │   │   ├── Node.tsx
│   │   │       │   │   ├── NodeRenderer.tsx
│   │   │       │   │   ├── NodeEditor.tsx
│   │   │       │   │   ├── NodeDragHandler.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── Shared/   # Mindmap専用共有UI
│   │   │       │   │   ├── SelectedNodeLinkList.tsx
│   │   │       │   │   └── index.ts
│   │   │       │   ├── layout/   # レイアウトコンポーネント
│   │   │       │   ├── modals/   # モーダル
│   │   │       │   ├── panels/   # パネル
│   │   │       │   └── index.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── shared/               # 統合された共通処理
│   │   │   ├── components/       # 共通コンポーネント
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── MarkdownEditor.tsx
│   │   │   │   ├── ui/           # Toolbar, ContextMenu など共通UI
│   │   │   │   │   ├── toolbar/
│   │   │   │   │   ├── contextmenu/
│   │   │   │   │   ├── Toolbar.tsx
│   │   │   │   │   ├── ContextMenu.tsx
│   │   │   │   │   └── ...
│   │   │   │   └── index.ts
│   │   │   ├── hooks/            # 共通Hooks（useBooleanState等）
│   │   │   ├── utils/            # 共通ユーティリティ
│   │   │   │   ├── arrayUtils.ts
│   │   │   │   ├── stringUtils.ts
│   │   │   │   ├── nodeUtils.ts
│   │   │   │   └── ...
│   │   │   ├── markdown/         # Markdown関連を集約
│   │   │   │   ├── markdownImporter.ts
│   │   │   │   ├── markdownLinkUtils.ts
│   │   │   │   ├── markdownNodeMerge.ts
│   │   │   │   └── useMarkdownSync.ts
│   │   │   ├── constants/        # 定数類を一本化
│   │   │   │   └── index.ts
│   │   │   ├── types/            # 型定義
│   │   │   │   ├── nodeTypes.ts
│   │   │   │   ├── dataTypes.ts
│   │   │   │   ├── uiTypes.ts
│   │   │   │   ├── storageTypes.ts
│   │   │   │   ├── monaco-vim.d.ts
│   │   │   │   └── index.ts
│   │   │   ├── styles/           # 共通スタイル
│   │   │   │   └── modalStyles.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── types/                # アプリケーション型定義
│   │   │   └── extension.d.ts
│   │   └── index.ts
│   │
│   ├── App.tsx                   # メインアプリケーションコンポーネント
│   ├── main.tsx                  # エントリーポイント
│   ├── index.css                 # グローバルスタイル
│   └── vite-env.d.ts            # Vite型定義
│
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.js
└── package.json
```

**Architecture Overview:**
- **Root:** `frontend/` contains the entire React application
- **Source:** `frontend/src/` with modular architecture:
  - `src/app/` — Main application modules with re-exports in `index.ts`
  - `src/app/core/` — Core architecture (hooks, store, services, storage, data)
  - `src/app/features/` — Feature modules organized by domain
  - `src/app/shared/` — Unified shared components, utilities, types, and constants
  - `src/app/types/` — Application-specific type definitions

**Unified Shared Structure:**
- **Completed Integration:** All shared code is now consolidated into `src/app/shared/`
- **Component Organization:** Canvas and Node components are properly separated into feature-specific directories
- **Path Alias Cleaned:** Only `@` and `@shared` aliases remain, legacy aliases removed
- **Single Source of Truth:** All shared utilities, components, and types are in one organized location

### Path Aliases (Vite + TypeScript)
- `@` → `src/`
- `@shared` → `src/app/shared/`

### Architecture Patterns
- **Modular exports:** All features re-export through `src/app/index.ts`
- **Hook-based core:** State management and business logic in `src/app/core/hooks/`
- **Feature-based organization:** Each feature (mindmap, files) has its own directory with components, hooks, types
- **Local-first:** No network calls, all data stored locally

### Key Technologies
- **Frontend:** React 18 + TypeScript 5.8 + Vite 6
- **State:** Zustand for state management
- **Editor:** Monaco Editor with Vim mode support
- **File handling:** JSZip for import/export
- **Markdown:** Marked for parsing
- **Icons:** Lucide React

## Code Quality Standards

### TypeScript Configuration
- **Strict mode enabled** with comprehensive type checking
- **Avoid unsafe patterns:** `any`, non-null assertions (`!`), unchecked type casts
- Use `npm run scan:unsafe` to detect these patterns
- Path mapping configured for clean imports

### ESLint Rules
- Warns on `@typescript-eslint/no-explicit-any`
- Strict React hooks rules (`react-hooks/rules-of-hooks`, `exhaustive-deps`)
- Unused variable warnings (prefix with `_` to ignore)
- TypeScript handles `no-undef`, so it's disabled in ESLint

### Build Validation
- `npm run build` includes automatic type-checking
- All builds must pass type-check, lint, and unsafe pattern scan
- Production builds output to `frontend/dist/` with sourcemaps

## Development Notes

### Vite Configuration
- **Base path:** `/Mindoodle/` for static hosting
- **Port:** 5174 (configurable via PORT env var)
- **Build output:** `frontend/dist/`

### Testing
- No test framework currently configured
- For future tests: Consider Vitest + React Testing Library
- Place tests as `*.test.ts(x)` alongside source files

### Local-First Philosophy
- All functionality works offline
- No external API calls or network dependencies
- Data stored locally using browser storage APIs
- Import/export for data portability