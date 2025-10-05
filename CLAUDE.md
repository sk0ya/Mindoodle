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

**Mindoodle** is a local-first, markdown-based mind mapping application built with React + TypeScript + Vite. It now supports both local storage and optional cloud storage via Cloudflare Workers backend.

### Directory Structure

**Current Directory Structure:**
```
/
├── frontend/                     # React frontend application
│   ├── public/                   # Static files (favicon, manifest, icons)
│   └── src/
├── backend/                      # Cloudflare Workers backend (optional cloud storage)
│   ├── src/
│   │   ├── index.ts              # Main worker entry point
│   │   ├── auth.ts               # Authentication logic
│   │   └── types.ts              # Backend type definitions
│   └── wrangler.toml             # Cloudflare Workers configuration
├── scripts/                      # Build and utility scripts
└── docs/                         # Documentation

frontend/src/
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
- **Hybrid storage:** Local-first with optional cloud storage via CloudStorageAdapter
  - **Local mode:** File System Access API or IndexedDB (MarkdownFolderAdapter)
  - **Cloud mode:** Cloudflare Workers + KV + R2 storage (CloudStorageAdapter)

### Key Technologies
- **Frontend:** React 18.2 + TypeScript 5.8 + Vite 6.3
- **State:** Zustand 5.0 + Immer 10.1 for state management
- **Editor:** Monaco Editor 0.52 with Monaco Vim 0.4 support
- **File handling:** JSZip 3.10 for import/export
- **Markdown:** Marked 16.2 for parsing
- **Diagrams:** Mermaid 10.9 for embedded diagrams
- **Icons:** Lucide React 0.544
- **Backend (optional):** Cloudflare Workers with KV and R2 storage

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
- All functionality works offline by default
- Optional cloud storage mode for synchronization across devices
- Data stored locally using browser storage APIs (File System Access API or IndexedDB)
- Import/export for data portability (ZIP format supported)

---

## Implementation Roadmap

### 🔴 Priority: High (Critical Bug Fixes)

#### ✅ COMPLETED
1. **Node Coordinate Glitch** - Fixed (commit: 4c2a2f4)
   - Eliminated Y-coordinate shift during node creation
2. **Mermaid Diagram Cache** - Fixed (commit: 9db8b3a)
   - Proper cache clearing on map data changes
3. **Search IME Support** - Fixed (commit: 6e06ae1)
   - Added IME support for Vim search and command modes
4. **Sidebar/Panel Resize** - Fixed (commit: e19c13d)
   - Improved resize event handling with capture phase

---

### 🟡 Priority: Medium (Feature Improvements)

#### ✅ COMPLETED
1. **Enhanced Search Navigation** - Implemented (commit: aea697a)
   - Improved search navigation to handle dynamic node changes
2. **Vim Search and Command Unification** - Implemented (commit: 9f720bc)
   - Unified Vim search and command input with dynamic mode switching
3. **Keyboard Shortcut Helper** - Enhanced (commit: a8a915e)
   - Dynamic generation and compact UI
4. **Inline Markdown Formatting** - Added (commit: 1aad32b)
   - Support for inline markdown with Vim keybindings
5. **Hierarchical Color System** - Added (commit: a99245a)
   - Mind map connections with color set selection
6. **System Clipboard Paste** - Added (commit: e9b0ec0)
   - Multi-line text paste support

#### 🎯 TODO
1. **Vim Keymap Customization**
   - Add keymap editor to settings screen
   - Use `monaco-vim` key mapping customization API

---

### 🟢 Priority: Low (New Features)

#### ✅ COMPLETED

1. **Cloud Storage Implementation** - Implemented (commit: 81e1150, 7bcb946)
   - CloudStorageAdapter with Cloudflare Workers backend
   - KV storage for user data and map metadata
   - R2 bucket for markdown files and images
   - Authentication system with email-based access
   - Workspace management for cloud mode
2. **Storage Adapter Refactoring** - Completed (commit: 109d463)
   - Simplified storage adapters, removed unnecessary metadata
3. **Paste Operation Enhancement** - Fixed (commit: 555d670)
   - Fixed undo/redo stack and checkbox preservation
4. **Checkbox Default State** - Added (commit: 1264599)
   - New checkbox nodes default to unchecked
5. **Blank Line Setting** - Added (commit: f08c9f0)
   - Blank line setting for heading nodes
6. **Cloud Image Storage Extension** - Implemented
   - Backend API endpoints for image upload, download, delete, and list
   - R2 bucket integration for image storage with user-specific paths
   - Frontend CloudStorageAdapter already supports image operations
   - Location: `backend/src/index.ts` (image endpoints added)

#### 🎯 TODO
1. **Multi-Node Selection**
   - `v` enters selection mode → select multiple → `m` for batch operations
   - Add selection state to Zustand store
2. **Additional Features (Future)**
   - Image Editor: Edit and save local attachment files
   - CSV Editor: Visual editing for Markdown tables
   - Drawing Tool: Freehand drawing functionality
   - Format Feature: Auto-formatting based on mind map structure

---

### 🏗️ Refactoring Plan

## ✅ Completed Refactoring

#### 1. ViewportService Implementation ✅ **COMPLETED**
- **Status:** Fully implemented and deployed
- **Implementation:**
  - Created `ViewportService` class in `frontend/src/app/core/services/`
  - Added `useViewport` hook for reactive viewport tracking
  - All files migrated to centralized service
- **Results:** Code deduplication, consistent responsive behavior, improved testability

#### 2. MindMapApp.tsx Component Split ✅ **COMPLETED**
- **Status:** Major refactoring complete (1731 → 881 lines, -850 lines / 49% reduction)
- **Extracted hooks:**
  - useMindMapLinks.ts (link handling)
  - useMindMapFileOps.ts (file operations)
  - useMindMapEvents.ts (event handling)
  - useMindMapClipboard.ts (clipboard operations)
  - useMindMapViewport.ts (viewport handling)
  - Additional hooks: useMindMapActions, useMindMapData, useMindMapPersistence, useMindMapUI
- **Results:** Improved separation of concerns, better HMR performance, easier testing

#### 3. Memory Management Utilities Consolidation ✅ **COMPLETED**
- **Status:** Fully implemented
- **Implementation:** Created unified `MemoryService` class at `frontend/src/app/core/services/MemoryService.ts`
- **Features:**
  - Timer management (intervals/timeouts)
  - Memory monitoring and snapshots
  - Threshold warnings and leak detection
  - Cleanup automation
- **Integration:** Already used in dataSlice, type-check validation passed

## 🔄 In Progress Refactoring

#### 4. Large File Refactoring (Progressive) - **PHASE 4 IN PROGRESS**
**Current targets (500-700 lines goal):**
- `MindMapSidebar.tsx` (1277 lines) - Analysis in progress
- `MarkdownEditor.tsx` (1273 lines)
- `MarkdownFolderAdapter.ts` (1193 lines)
- `markdownImporter.ts` (1140 lines)
- `NodeRenderer.tsx` (1070 lines)

## 🟢 Low Priority Improvements

#### 5. Type Definition Cleanup
- Consolidate `MindMapNode` and `MindMapData` type definitions
- Resolve circular dependencies
- Single source of truth for core types

#### 6. Hooks Optimization
- Remove unused hooks
- Optimize dependency arrays
- Follow ARCHITECTURE_GUIDELINES.md patterns

## 📅 Implementation Roadmap

**Phase 1: ViewportService** ✅ **COMPLETED**
- [x] Analysis complete
- [x] ViewportService implementation
- [x] Hook creation and migration
- [x] All files migrated to ViewportService
- **Result:** Zero direct window.innerWidth/Height usage

**Phase 2: MindMapApp Split** ✅ **COMPLETED**
- [x] Extract link handlers to useMindMapLinks hook
- [x] Extract file operations to useMindMapFileOps hook
- [x] Extract event handlers to useMindMapEvents hook
- [x] Extract clipboard operations to useMindMapClipboard hook
- [x] Extract viewport handling to useMindMapViewport hook
- [x] Refactor main component (1731→881 lines, -850 lines / 49% reduction)
- [x] Type-check validation passed
- **Result:** Modular, maintainable architecture

**Phase 3: Memory Management** ✅ **COMPLETED**
- [x] Design MemoryService API
- [x] Implement unified MemoryService class
- [x] Migrate dataSlice to use MemoryService
- [x] Type-check validation passed
- [x] Fixed type issues (MarkdownEditor, monaco-vim)
- **Result:** Centralized memory management with monitoring

**Phase 4: Large File Refactoring** 🔄 **IN PROGRESS**
- [x] Identify target files (5 files > 1000 lines)
- [ ] MindMapSidebar.tsx (1277 lines) - Analysis phase
- [ ] MarkdownEditor.tsx (1273 lines)
- [ ] MarkdownFolderAdapter.ts (1193 lines)
- [ ] markdownImporter.ts (1140 lines)
- [ ] NodeRenderer.tsx (1070 lines)
- **Target:** 500-700 lines per file

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

### 📊 Recent Achievements & Implementation Status

#### Completed Phases

**Phase 1: Critical Bug Fixes** ✅ COMPLETED
- ✅ Node coordinate glitch fixed
- ✅ Mermaid cache issue resolved
- ✅ IME support for search implemented
- ✅ Sidebar resize behavior improved

**Phase 2: Feature Enhancements** ✅ MOSTLY COMPLETED
- ✅ Enhanced search navigation
- ✅ Vim search/command unification
- ✅ Keyboard shortcut helper improvements
- ✅ Inline markdown formatting
- ✅ Hierarchical color system
- ✅ System clipboard paste support
- ⏳ Vim keymap customization (pending)

**Phase 3: Cloud Infrastructure** ✅ COMPLETED
- ✅ CloudStorageAdapter implementation
- ✅ Cloudflare Workers backend
- ✅ Authentication system
- ✅ Workspace management
- ⏳ Cloud image storage (pending)

#### Next Steps

**Short-term priorities:**
1. Complete Vim keymap customization
2. Implement cloud image storage for paste operations
3. Multi-node selection feature

**Long-term goals:**
- Image editor integration
- CSV editor for Markdown tables
- Drawing tool for freehand annotations
- Enhanced export features (PDF, SVG, PNG)

---

### 🧪 Testing Strategy

#### Cloud Storage Adapter Testing
- **Priority:** Test file operations in cloud adapter
- **Location:** `frontend/src/app/core/storage/adapters/CloudStorageAdapter.ts`
- **Status:** ✅ Core functionality implemented and deployed
- **Verified Features:**
  - User registration and authentication
  - Workspace creation and deletion
  - Map CRUD operations (create, read, update, delete)
  - R2 markdown storage integration
  - KV metadata storage
- **Pending Tests:**
  - Image file upload/delete to R2
  - Concurrent workspace operations
  - Error handling and recovery

---

## Backend Deployment

### Cloudflare Workers Configuration

**Production Environment:**
- Worker name: `mindoodle-backend`
- KV Namespace: `USERS` (id: 26ed643d1e894f3cae22e60b4e8cd566)
- R2 Bucket: `mindoodle-maps`
- Allowed email: shigekazukoya@gmail.com

**Development Environment:**
- KV Namespace: `USERS` (id: 49eb2b709ef04f94a2550901c4df8631)
- R2 Bucket: `mindoodle-maps-dev`

**Deployment Commands:**
```bash
cd backend
wrangler deploy                    # Deploy to production
wrangler deploy --env development  # Deploy to development
```

**Backend Features:**
- Email-based authentication
- User session management with KV storage
- Map metadata storage in KV
- Markdown file storage in R2 buckets
- Image file storage in R2 (ready for frontend integration)
- CORS enabled for frontend communication