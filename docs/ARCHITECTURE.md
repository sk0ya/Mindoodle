# Architecture

This document describes the Mindoodle architecture and project structure.

## Project Architecture

Mindoodle is a local-first, markdown-based mind mapping application built with React + TypeScript + Vite. It supports local storage and optional cloud storage via a Cloudflare Workers backend.

### Directory Structure

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
│   │   ├── commands/             # コマンドシステム（Command Pattern）
│   │   │   ├── navigation/       # ナビゲーションコマンド
│   │   │   ├── structure/        # 構造操作コマンド
│   │   │   ├── system/           # システムコマンド（registry, types, guards）
│   │   │   ├── ui/               # UIコマンド
│   │   │   ├── editing/          # 編集コマンド
│   │   │   └── application/      # アプリケーションコマンド（switch-map等）
│   │   │
│   │   ├── core/                 # コアアーキテクチャ
│   │   │   ├── data/             # データ管理（normalizedStore）
│   │   │   ├── storage/          # ストレージ管理
│   │   │   │   └── adapters/     # ストレージアダプター（Local/Cloud）
│   │   │   ├── services/         # コアサービス（Memory, Viewport）
│   │   │   ├── streams/          # データストリーム（event bus）
│   │   │   └── types/            # コア型定義
│   │   │
│   │   ├── features/             # 機能単位（feature-based organization）
│   │   │   ├── mindmap/          # マインドマップ機能
│   │   │   │   ├── controllers/  # MindMapController（配線・副作用）
│   │   │   │   ├── state/        # 状態機械（uiModeMachine, panelManager）
│   │   │   │   ├── handlers/     # ベースハンドラー（Renderer, Drag, Event）
│   │   │   │   ├── services/     # サービス層（Navigation, Viewport, Clipboard, EditingState）
│   │   │   │   ├── selectors/    # セレクター（ノード探索・行番号解決）
│   │   │   │   ├── events/       # Event Strategy（Normal/Insert/Visual, dispatcher）
│   │   │   │   ├── hooks/        # Mindmap専用Hooks
│   │   │   │   ├── utils/        # Mindmap専用ユーティリティ
│   │   │   │   ├── components/
│   │   │   │   │   ├── toolbar/       # ツールバーコンポーネント
│   │   │   │   │   ├── managers/      # マネージャーコンポーネント
│   │   │   │   │   ├── Node/          # Node関連コンポーネント
│   │   │   │   │   ├── Canvas/        # Canvas関連コンポーネント
│   │   │   │   │   ├── panels/        # パネルコンポーネント
│   │   │   │   │   ├── layout/        # レイアウトコンポーネント
│   │   │   │   │   │   ├── common/    # 共通レイアウト
│   │   │   │   │   │   ├── overlay/   # オーバーレイ（context menu等）
│   │   │   │   │   │   ├── panel/     # パネル系
│   │   │   │   │   │   └── sidebar/   # サイドバー系
│   │   │   │   │   ├── modals/        # モーダルコンポーネント
│   │   │   │   │   ├── Shared/        # Mindmap専用共有UI
│   │   │   │   │   └── contextmenu/   # コンテキストメニュー
│   │   │   │   ├── store/        # Mindmap専用ストア（Zustand + Immer）
│   │   │   │   │   └── slices/   # ストアスライス（ui, node, data, ai, history, settings）
│   │   │   │   ├── styles/       # Mindmapスタイル
│   │   │   │   └── types/        # Mindmap専用型定義
│   │   │   ├── file-management/  # ファイル管理機能
│   │   │   │   └── hooks/
│   │   │   ├── ai/               # AI機能（Ollama）
│   │   │   │   ├── services/
│   │   │   │   └── hooks/
│   │   │   ├── vim/              # Vim機能（monaco-vim）
│   │   │   │   ├── hooks/
│   │   │   │   ├── utils/
│   │   │   │   ├── components/
│   │   │   │   ├── styles/
│   │   │   │   └── context/
│   │   │   ├── theme/            # テーマ機能
│   │   │   │   └── hooks/
│   │   │   └── markdown/         # Markdown機能
│   │   │       ├── services/
│   │   │       ├── vim/
│   │   │       ├── hooks/
│   │   │       ├── components/
│   │   │       └── styles/
```

### Path Aliases (Vite + TS)

- `@` → `src/`
- `@shared` → `src/app/shared/`

### Architecture Patterns

- **Command Pattern**: All operations flow through `@commands/system/registry` with guard-based preconditions.
- **Event Strategy Pattern**: Mode-based event handling (Normal/Insert/Visual) via `@mindmap/events/dispatcher`.
- **Service Layer**: Reusable business logic (Navigation, Viewport, Clipboard, EditingState).
- **Selector Pattern**: Node queries and state derivation in `@mindmap/selectors/mindMapSelectors`.
- **State Machines**: UI mode (`uiModeMachine`) and panel management (`panelManager`) for type-safe state.
- **Feature-based Organization**: Each feature has `controllers`, `services`, `hooks`, `components`, `store`, `types`.
- **Modular Exports**: Aggregated via `src/app/index.ts` to prevent deep imports.
- **Zustand Store**: Per-feature stores; mindmap uses slice pattern (ui, node, data, ai, history, settings).
- **Hybrid Storage**: Local-first with optional cloud adapter.
  - Local: File System Access API or IndexedDB (MarkdownFolderAdapter)
  - Cloud: Cloudflare Workers + KV + R2 (CloudStorageAdapter)

### Core Architecture Components

#### Command System (`app/commands/`)

The application uses a **Command Pattern** architecture where all operations flow through a central registry:

- **Command Registry** ([registry.ts](../frontend/src/app/commands/system/registry.ts)): Central command registration, lookup, and execution
  - `CommandRegistryImpl`: Manages command registration with alias support
  - `execute()`: Validates guards, runs commands, handles errors
  - Command discovery via name, alias, category, or full-text search
- **Command Categories**:
  - `navigation/`: Node navigation commands (move, focus, center)
  - `structure/`: Tree structure operations (toggle, expand/collapse)
  - `editing/`: Content editing (insert, delete, format)
  - `ui/`: UI control (show panels, toggle views)
  - `application/`: App-level commands (switch map, settings)
- **Guard Pattern**: Commands implement `guard(context)` for precondition validation
- **Input Sources**: Keyboard shortcuts, Vim commands, Command Palette, Context Menu all dispatch through registry

#### Event Strategy Pattern (`mindmap/events/`)

Mode-based event handling using the **Strategy Pattern**:

- **Dispatcher** ([dispatcher.ts](../frontend/src/app/features/mindmap/events/dispatcher.ts)): Routes events based on current mode
- **Strategies**:
  - `NormalModeStrategy`: Default navigation and selection
  - `InsertModeStrategy`: Text editing and node creation
  - `VisualModeStrategy`: Multi-select and visual operations
- **Event Types**: Click, DoubleClick, RightClick, MouseDown, MouseMove, MouseUp
- Mode detection via `useMindMapStore.getState().ui.mode`

#### State Management (`mindmap/store/`)

**Zustand** store with **Immer** for immutable updates, organized by slices:

- **Store Slices** ([slices/](../frontend/src/app/features/mindmap/store/slices/)):
  - `uiSlice`: UI mode, active panels, viewport state
  - `nodeSlice`: Node selection, focus, editing state
  - `dataSlice`: Mind map data, tree structure
  - `aiSlice`: AI generation state
  - `historySlice`: Undo/redo stack
  - `settingsSlice`: User preferences, theme
- **Selectors** ([selectors/mindMapSelectors.ts](../frontend/src/app/features/mindmap/selectors/mindMapSelectors.ts)):
  - Node queries (by ID, by path, by line number)
  - Tree traversal (parent, children, siblings, descendants)
  - State derivation (selected nodes, visible nodes)

#### Service Layer

Reusable business logic extracted into focused services:

- **Core Services** (`core/services/`):
  - `MemoryService`: Session memory and context preservation
  - `ViewportService`: Canvas viewport calculations and transformations
  - `EmbeddingService`/`EmbeddingOrchestrator`: Vector embeddings for semantic search
  - `VectorStore`: Vector similarity search
- **Mindmap Services** (`mindmap/services/`):
  - `NodeNavigationService`: Tree navigation logic (next, prev, parent, child)
  - `NodeClipboardService`: Copy/paste/cut operations
  - `EditingStateService`: Track editing state and transitions
  - `ViewportScrollService`: Viewport scrolling and centering
  - `imagePasteService`: Image paste handling
- **Shared Services** (`shared/services/`):
  - `WorkspaceService`: Workspace management

#### Storage Architecture (`core/storage/`)

**Adapter Pattern** for hybrid local/cloud storage:

- **AdapterManager** ([AdapterManager.ts](../frontend/src/app/core/storage/AdapterManager.ts)): Manages storage adapter lifecycle
- **Adapters** ([adapters/](../frontend/src/app/core/storage/adapters/)):
  - `MarkdownFolderAdapter`: File System Access API or IndexedDB
  - `CloudStorageAdapter`: Cloudflare Workers + KV + R2
- **StorageAdapterFactory**: Creates appropriate adapter based on mode
- **Local Storage** ([localStorage.ts](../frontend/src/app/core/storage/localStorage.ts)): Browser localStorage wrapper

#### State Machines (`mindmap/state/`)

Type-safe state management with explicit transitions:

- `uiModeMachine`: UI mode transitions (normal ↔ insert ↔ visual)
- `panelManager`: Panel visibility and layout state

### Recent Architecture Improvements (2025-10)

- **Command-driven Input**: Unified all input sources (keyboard, vim, palette, context menu) through Command Registry
- **Event Strategy Refactoring**: Replaced monolithic `CanvasEventHandler` with mode-based strategies (Normal/Insert/Visual)
- **Controller Extraction**: Moved business logic from `MindMapApp.tsx` to `MindMapController` and dedicated services
- **Global Bridge Elimination**: Replaced `window.mindoodle*` and CustomEvents with typed Command/Service APIs
- **Layout Reorganization**: Restructured components into `common/overlay/panel/sidebar` subdirectories
- **Hierarchical Hook Structure**: Consolidated sidebar logic into unified `useSidebar` hook
- **Service Layer**: Extracted Navigation, Viewport, Clipboard, EditingState into reusable services
- **Selector Pattern**: Centralized node queries in `mindMapSelectors` for consistent state access

#### Component Architecture

**Layout Structure** ([components/layout/](../frontend/src/app/features/mindmap/components/layout/)):

- `MindMapApp.tsx`: Main application container
- `MindMapWorkspace.tsx`: Workspace layout with canvas and panels
- `MindMapCanvas.tsx`: Canvas rendering container
- `MindMapProviders.tsx`: Context providers wrapper
- `MindMapOverlays.tsx`: Modal and overlay management

**Component Categories**:

- **Canvas** ([Canvas/](../frontend/src/app/features/mindmap/components/Canvas/)): Canvas rendering, event handling, drag operations
- **Node** ([Node/](../frontend/src/app/features/mindmap/components/Node/)): Node rendering, editing, drag handling
- **Toolbar** ([toolbar/](../frontend/src/app/features/mindmap/components/toolbar/)): Title editor, action buttons, storage switch
- **Sidebar** ([layout/sidebar/](../frontend/src/app/features/mindmap/components/layout/sidebar/)): Primary sidebar, explorer, search, settings, AI, Vim
- **Panels** ([panels/](../frontend/src/app/features/mindmap/components/panels/)): Node notes, font settings, presets, image resize
- **Modals** ([modals/](../frontend/src/app/features/mindmap/components/modals/)): AI generation, links, images, knowledge graph

#### Hook Organization

**Feature Hooks** ([mindmap/hooks/](../frontend/src/app/features/mindmap/hooks/)):

- `useMindMap.ts`: Main orchestrator hook (consolidates all features)
- `useMindMapActions.ts`: Action handlers (node operations)
- `useMindMapData.ts`: Data loading and management
- `useMindMapEvents.ts`: Event subscription and handling
- `useMindMapViewport.ts`: Viewport state and transformations
- `useMindMapClipboard.ts`: Clipboard operations
- `useKeyboardShortcuts.ts`: Keyboard shortcut handling
- `useCommandExecution.ts`: Command execution bridge
- `useSidebar.tsx`: Unified sidebar state management

**Shared Hooks** ([shared/hooks/](../frontend/src/app/shared/hooks/)):

- **System**: `useEventListener`, `useErrorHandler`, `useInitializationWaiter`
- **UI**: `useModal`, `useViewport`, `useCommandPalette`, `useDragAndDrop`
- **Data**: `useModelLoader`, `useDataReset`, `useDataCleanup`

**Hook Composition Pattern**: Feature hooks delegate to specialized hooks, which use service layer for business logic

### Key Technologies

- **Frontend**: React 18 + TypeScript 5 + Vite 6
- **State**: Zustand + Immer
- **Editor**: CodeMirror 6 + @replit/codemirror-vim
- **File handling**: JSZip for import/export
- **Markdown**: Marked
- **Diagrams**: Mermaid
- **Icons**: Lucide React
- **Backend** (optional): Cloudflare Workers with KV and R2

### Code Quality Standards

- TypeScript strict mode; avoid `any`, non-null `!`, unchecked casts.
- ESLint enforces `@typescript-eslint`, `react`, `react-hooks` rules.
- Unused variables should be removed or prefixed with `_`.

### Build & Dev Notes

- Build includes type-checking; outputs to `frontend/dist/` with sourcemaps.
- Vite base path is `/Mindoodle/`; dev server on port 5174 (configurable via `PORT`).

### Testing

- No test runner configured; prefer Vitest + React Testing Library if added.
- Place tests as `*.test.ts(x)` alongside code; avoid real timers and network.

### Local-First Philosophy

- Works offline by default; optional cloud sync mode.
- Data stored locally (File System Access API or IndexedDB).
- Import/export supported (ZIP).

