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
├── src/
│   ├── app/                      # アプリケーションのコア（データ層・サービス）
│   │   ├── commands/             # コマンドシステム
│   │   │   ├── navigation/       # ナビゲーションコマンド
│   │   │   ├── structure/        # 構造操作コマンド
│   │   │   ├── system/           # システムコマンド
│   │   │   ├── ui/               # UIコマンド
│   │   │   ├── editing/          # 編集コマンド
│   │   │   └── application/      # アプリケーションコマンド
│   │   │
│   │   ├── core/                 # コアアーキテクチャ
│   │   │   ├── data/             # データ管理
│   │   │   ├── storage/          # ストレージ管理
│   │   │   │   └── adapters/     # ストレージアダプター
│   │   │   ├── services/         # コアサービス
│   │   │   ├── streams/          # データストリーム
│   │   │   └── types/            # コア型定義
│   │   │
│   │   ├── features/             # 機能単位（mindmap, etc.）
│   │   │   ├── mindmap/          # マインドマップ機能
│   │   │   │   ├── handlers/     # イベントハンドラー
│   │   │   │   ├── services/     # サービス層
│   │   │   │   ├── hooks/        # Mindmap専用Hooks
│   │   │   │   ├── utils/        # Mindmap専用ユーティリティ
│   │   │   │   ├── components/
│   │   │   │   │   ├── toolbar/       # ツールバーコンポーネント
│   │   │   │   │   ├── managers/      # マネージャーコンポーネント
│   │   │   │   │   ├── Node/          # Node関連コンポーネント
│   │   │   │   │   ├── Canvas/        # Canvas関連コンポーネント
│   │   │   │   │   ├── panels/        # パネルコンポーネント
│   │   │   │   │   ├── layout/        # レイアウトコンポーネント
│   │   │   │   │   ├── modals/        # モーダルコンポーネント
│   │   │   │   │   ├── Shared/        # Mindmap専用共有UI
│   │   │   │   │   └── contextmenu/   # コンテキストメニュー
│   │   │   │   ├── store/        # Mindmap専用ストア
│   │   │   │   │   └── slices/   # ストアスライス
│   │   │   │   ├── styles/       # Mindmapスタイル
│   │   │   │   └── types/        # Mindmap専用型定義
│   │   │   ├── file-management/  # ファイル管理機能
│   │   │   │   ├── services/
│   │   │   │   ├── hooks/
│   │   │   │   ├── components/
│   │   │   │   └── types/
│   │   │   ├── ai/               # AI機能
│   │   │   │   ├── services/
│   │   │   │   └── hooks/
│   │   │   ├── vim/              # Vim機能
│   │   │   │   ├── hooks/
│   │   │   │   └── context/
│   │   │   ├── theme/            # テーマ機能
│   │   │   │   └── hooks/
│   │   │   ├── markdown/         # Markdown機能
│   │   │   │   ├── services/
│   │   │   │   ├── hooks/
│   │   │   │   └── components/
│   │   │   └── files/            # ファイル機能
│   │   │       └── components/
│   │   │
│   │   ├── shared/               # 統合された共通処理
│   │   │   ├── hooks/            # 共通Hooks（カテゴリ別）
│   │   │   │   ├── system/       # システム関連hooks
│   │   │   │   ├── data/         # データ関連hooks
│   │   │   │   ├── ui/           # UI関連hooks
│   │   │   │   └── network/      # ネットワーク関連hooks
│   │   │   ├── utils/            # 共通ユーティリティ
│   │   │   ├── constants/        # 定数類を一本化
│   │   │   ├── components/       # 共通コンポーネント
│   │   │   ├── types/            # 共通型定義
│   │   │   └── styles/           # 共通スタイル
│   │   │       ├── ui/
│   │   │       └── layout/
│   │   │
│   │   └── types/                # アプリケーション型定義
│   │
│   ├── App.tsx                   # メインアプリケーションコンポーネント
│   ├── main.tsx                  # エントリーポイント
│   ├── index.css                 # グローバルスタイル
│   └── vite-env.d.ts            # Vite型定義
│
├── eslint.config.js              # ESLint設定
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.strict.json          # 厳密なTypeScript設定
├── tsconfig.strict.vim.json      # Vim用厳密設定
├── vite.config.js
└── package.json
```

**Architecture Overview:**
- **Root:** `frontend/` contains the entire React application
- **Source:** `frontend/src/` with modular architecture:
  - `src/app/` — Main application modules with re-exports in `index.ts`
  - `src/app/core/` — Core architecture (commands, data, storage, streams, types)
  - `src/app/features/` — Feature modules organized by domain (mindmap, file-management, ai, editor, theme, markdown)
  - `src/app/shared/` — Unified shared hooks, utils, components, types, and styles
  - `src/app/types/` — Application-specific type definitions

**Feature-Based Organization:**
- **Mindmap Feature:** Complete mindmap functionality with handlers, services, hooks, utils, components (toolbar, Canvas, Node, Layout, Modals), store, styles, and types
- **Additional Features:** File management, AI integration, Vim mode, theme system, markdown processing, and file handling
- **Component Hierarchy:** Canvas and Node components are properly separated within mindmap feature
- **Domain Separation:** Each feature maintains its own services, hooks, components, and types
- **Legacy Structure:** `src/shared/` contains legacy shared components being migrated to `src/app/shared/`

### Path Aliases (Vite + TypeScript)
- `@` → `src/`
- `@shared` → `src/app/shared/`

### Architecture Patterns
- **Modular exports:** All features re-export through `src/app/index.ts`
- **Command-driven core:** Command system in `src/app/commands/` with domain-specific command categories
- **Feature-based organization:** Each feature (mindmap, file-management, ai, vim, theme, markdown, files) has its own directory with services, hooks, components, store, and types
- **Zustand store architecture:** Feature-specific stores with mindmap store using slice pattern
- **Local-first:** No network calls, all data stored locally with multiple storage adapters

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

---

## Implementation Roadmap

### 🔴 Priority: High (Critical Bug Fixes)

#### 1. Node Coordinate Glitch
- **Issue:** Y-coordinate temporarily shifts when adding child nodes or confirming text
- **Root Cause:** Timing issue in `updateNormalizedNode` coordinate calculation
- **Location:** `frontend/src/app/core/data/normalizedStore.ts`
- **Fix:** Synchronize coordinate updates, ensure coordinates are finalized before rendering

#### 2. Mermaid Diagram Cache Issue
- **Issue:** Outdated cached diagrams persist after map updates
- **Workaround:** Auto-layout triggers redraw
- **Location:** `frontend/src/app/features/mindmap/utils/mermaidCache.ts`
- **Fix:** Review cache invalidation triggers, implement proper cache-busting strategy

#### 3. Search IME Support
- **Issue:** IME input not working in search field
- **Current Status:** Deprioritized due to limited use case
- **Fix:** Check Monaco Editor IME settings or switch to standard input element

#### 4. Sidebar/Panel Resize Issues
- **Issue:** Unstable drag behavior when resizing panels
- **Fix:** Improve drag handler logic, set appropriate boundary constraints

---

### 🟡 Priority: Medium (Feature Improvements)

#### 5. Enhanced Search Navigation
- **Feature:** "Find next" should navigate from current node
- **Location:** `frontend/src/app/features/mindmap/utils/searchUtils.ts`
- **Implementation:**
  - Filter search results based on current node ID
  - Implement circular search (wrap to beginning after last result)

#### 6. Vim Keymap Customization
- **Feature:** Allow users to customize Vim keybindings
- **Location:** `frontend/src/app/features/vim/`
- **Implementation:**
  - Add keymap editor to settings screen
  - Use `monaco-vim` key mapping customization API

---

### 🟢 Priority: Low (New Features)

#### 7. Cloud Features Extension
- **File Upload:** Already implemented in CloudStorageAdapter
- **Image Paste:** Add R2 bucket upload support
- **Location:** `frontend/src/app/features/mindmap/services/imagePasteService.ts`
- **Implementation:** Branch image handling based on cloud mode

#### 8. Multi-Node Selection
- **UX Design:** `v` enters selection mode → select multiple → `m` for batch operations
- **Implementation:**
  - Add selection state to Zustand store
  - Create batch operation commands for multiple nodes

#### 9. Additional Features (Future)
- **Image Editor:** Edit and save local attachment files
- **CSV Editor:** Visual editing for Markdown tables
- **Drawing Tool:** Freehand drawing functionality
- **Format Feature:** Auto-formatting based on mind map structure
- **Markdown Initial Settings:** Apply configuration to markdown rendering

---

### 🏗️ Refactoring Proposals

#### 10. Centralize Viewport Information Retrieval
- **Issue:** Code for retrieving current screen info is scattered throughout codebase
- **Recommendation:**
  - Create `ViewportService` class
  - Use singleton pattern for centralized state management
  - Place in `frontend/src/app/core/services/`

---

### 💡 Additional Ideas

#### 11. Performance Optimization
- **Virtualized Rendering:** Limit displayed nodes for large maps
- **Lazy Loading:** Progressive rendering of Mermaid diagrams

#### 12. Accessibility Improvements
- **Keyboard Navigation:** Full keyboard access to all features
- **Screen Reader Support:** Add ARIA attributes

#### 13. Enhanced Export Features
- **PDF Export:** Print-ready PDF output of mind maps
- **SVG/PNG Export:** Image format exports

#### 14. Template System
- **Preset Saving:** Save custom node styles
- **Map Templates:** Reuse common mind map structures

---

### 📊 Recommended Implementation Sequence

```
Phase 1: Bug Fixes (1-2 weeks)
├─ Fix node coordinate glitch
├─ Fix Mermaid cache issue
└─ IME support for search

Phase 2: Basic Feature Improvements (2-3 weeks)
├─ Enhanced search navigation (find next)
├─ Improve sidebar resize behavior
└─ Vim keymap customization

Phase 3: New Features (4-6 weeks)
├─ Multi-node selection
├─ Cloud image support
└─ ViewportService refactoring

Phase 4: Extensions (Optional)
├─ Image editor & CSV editor
├─ Drawing tool
└─ Export feature expansion
```

---

### 🧪 Testing Strategy

#### Cloud Storage Adapter Testing
- **Priority:** Test file operations in cloud adapter
- **Location:** `frontend/src/app/core/storage/adapters/CloudStorageAdapter.ts`
- **Test Cases:**
  - File creation and deletion
  - Folder operations
  - Category support
  - R2 markdown storage integration