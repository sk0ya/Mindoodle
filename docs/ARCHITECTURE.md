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
  - `CommandRegistryImpl`: Singleton registry managing all commands
    - **Key Methods**:
      - `register({ name, execute, guard, category, description, aliases })`: Register new command
      - `execute(name, context)`: Validate guard → execute → error handling
      - `get(name)`: Retrieve command by name or alias
      - `search(query)`: Full-text search with score-based ranking
      - `getByCategory(category)`: Filter commands by category
      - `canExecute(name, context)`: Check if guard passes without execution
    - **Command Structure**:
      ```typescript
      interface Command {
        name: string;              // Unique identifier (e.g., 'move-up')
        execute: (context) => void; // Implementation
        guard?: (context) => boolean; // Precondition check
        category?: string;         // Grouping (navigation/editing/ui/structure/application)
        description?: string;      // Help text for command palette
        aliases?: string[];        // Alternative names (e.g., ['up', 'k'])
      }
      ```
- **Command Categories**:
  - `navigation/`: Node navigation (move-up, move-down, move-left, move-right, focus-node, center-node)
  - `structure/`: Tree operations (toggle-collapse, expand-all, collapse-all, indent-node, outdent-node)
  - `editing/`: Content editing (insert-child, insert-sibling, delete-node, edit-text, duplicate-node)
  - `ui/`: UI control (toggle-sidebar, show-search, command-palette, toggle-vim-mode)
  - `application/`: App-level (switch-map, open-settings, import-zip, export-zip)
- **Guard Pattern**: Commands implement `guard(context)` for precondition validation
  - Example: `guard: (ctx) => ctx.selectedNodeId != null` ensures node selection before execution
  - Guards prevent invalid operations and provide early validation
  - Failed guards do not execute command, avoiding runtime errors
- **Input Sources**: All input unified through registry
  - Keyboard shortcuts → `registry.execute(commandName, context)`
  - Vim commands → `registry.execute(commandName, context)`
  - Command Palette → `registry.execute(commandName, context)`
  - Context Menu → `registry.execute(commandName, context)`
- **Command Flow**:
  ```
  User Input → Input Handler → CommandRegistry.execute()
    ↓
  Guard Check (pass/fail)
    ↓
  Command.execute(context)
    ↓
  Store Update → UI Re-render
  ```

#### Event Strategy Pattern (`mindmap/events/`)

Mode-based event handling using the **Strategy Pattern**:

- **Dispatcher** ([dispatcher.ts](../frontend/src/app/features/mindmap/events/dispatcher.ts)): Routes events based on current mode
  - `dispatchCanvasEvent(event)`: Main entry point for all canvas events
  - Reads current mode from `useMindMapStore.getState().ui.mode`
  - Selects appropriate strategy and delegates event handling
- **Strategies** ([CanvasEvent.{normal,insert,visual}.ts](../frontend/src/app/features/mindmap/events/)):
  - `NormalModeStrategy`: Default navigation and selection
    - Click: Select node
    - DoubleClick: Enter insert mode
    - RightClick: Show context menu
  - `InsertModeStrategy`: Text editing and node creation
    - Click: Focus text editor
    - Escape: Exit to normal mode
  - `VisualModeStrategy`: Multi-select and visual operations
    - Click: Toggle node selection
    - Drag: Multi-select area
- **Event Types**: Click, DoubleClick, RightClick, MouseDown, MouseMove, MouseUp
- **Implementation**:
  ```typescript
  interface EventStrategy {
    handle(event: CanvasEvent): void;
  }

  // Usage
  dispatchCanvasEvent({
    type: 'click',
    nodeId: 'node-123',
    position: { x: 100, y: 200 }
  });
  ```

#### State Management (`mindmap/store/`)

**Zustand** store with **Immer** for immutable updates, organized by slices:

- **Store Architecture** ([mindMapStore.ts](../frontend/src/app/features/mindmap/store/mindMapStore.ts)):
  - Created with `create<MindMapStore>()(devtools(subscribeWithSelector(immer(...))))`
  - Middleware: Devtools for debugging, subscribeWithSelector for selective subscriptions, Immer for immutability
  - All slices combined into single store for performance
- **Store Slices** ([slices/](../frontend/src/app/features/mindmap/store/slices/)):
  - `dataSlice`: Mind map data, tree structure
    - `rootNodes`: Array of root-level MindMapNode trees
    - `setRootNodes()`, `updateNode()`, `deleteNode()`
  - `uiSlice`: UI mode, active panels, viewport state
    - `mode`: 'normal' | 'insert' | 'visual' | 'menu'
    - `zoom`, `pan`: Viewport transformation
    - Panel visibility flags (sidebar, notes, markdown)
  - `nodeSlice`: Node selection, focus, editing state
    - `selectedNodeId`: Currently selected node
    - `editingNodeId`: Node being edited
    - `selectNode()`, `startEditing()`, `finishEditing()`
  - `historySlice`: Undo/redo stack
    - `past`, `future`: Arrays of snapshots
    - `undo()`, `redo()`, `scheduleCommitSnapshot()`
  - `settingsSlice`: User preferences, theme
    - `fontSize`, `theme`, `vimMode`
    - `nodeTextWrapEnabled`, `nodeTextWrapWidth`
- **Selectors** ([selectors/mindMapSelectors.ts](../frontend/src/app/features/mindmap/selectors/mindMapSelectors.ts)):
  - `selectNodeIdByMarkdownLine(rootNodes, line)`: Find node by markdown line number
  - `findParentNode(rootNodes, targetId)`: Get parent node
  - `getSiblingNodes(root, targetId)`: Get siblings with current index
  - `flattenVisibleNodes(root)`: Get all visible nodes in tree order (respects collapse state)
- **Store Updates**:
  ```typescript
  // Immer allows direct mutation syntax
  useMindMapStore.setState((state) => {
    state.ui.zoom = 1.5;  // Immer handles immutability
    state.node.selectedNodeId = 'node-123';
  });

  // Or use slice actions
  const { selectNode, setZoom } = useMindMapStore.getState();
  selectNode('node-123');
  setZoom(1.5);
  ```

#### Service Layer

Reusable business logic extracted into focused services:

- **Core Services** (`core/services/`):
  - `MemoryService`: Session memory and context preservation
  - `ViewportService`: Canvas viewport calculations and transformations
    - `getSize()`: Get viewport dimensions
    - `screenToCanvas(x, y, zoom, pan)`: Convert screen coordinates to canvas coordinates
  - `EmbeddingService`/`EmbeddingOrchestrator`: Vector embeddings for semantic search
  - `VectorStore`: Vector similarity search
- **Mindmap Services** (`mindmap/services/`):
  - `NodeNavigationService` ([NodeNavigationService.ts](../frontend/src/app/features/mindmap/services/NodeNavigationService.ts)):
    - `getNextNodeId(direction, selectedNodeId, roots)`: Calculate next node in given direction
    - Direction logic: 'left' → parent, 'right' → closest child, 'up'/'down' → siblings or adjacent roots
    - `findParent(roots, nodeId)`: Get parent node
  - `NodeClipboardService` ([NodeClipboardService.ts](../frontend/src/app/features/mindmap/services/NodeClipboardService.ts)):
    - `copyNodeToClipboard(node, markdownText)`: Copy node as markdown with hash validation
    - `copyNodeTextToClipboard(node)`: Copy as indented text with list markers
    - `nodeToMarkdownTree(node, level)`: Convert node tree to markdown hierarchy
    - `nodeToIndentedText(node, level)`: Convert to indented text format
    - Hash-based copy validation to prevent duplicate pastes
  - `ViewportScrollService` ([ViewportScrollService.ts](../frontend/src/app/features/mindmap/services/ViewportScrollService.ts)):
    - `ensureVisible(nodeId, ui, setPan, roots)`: Scroll viewport to ensure node is visible
    - Calculates viewport dimensions accounting for sidebars and panels
    - Handles node size with text wrapping for accurate positioning
  - `EditingStateService` ([EditingStateService.ts](../frontend/src/app/features/mindmap/services/EditingStateService.ts)):
    - Track editing state and transitions
  - `imagePasteService` ([imagePasteService.ts](../frontend/src/app/features/mindmap/services/imagePasteService.ts)):
    - Image paste handling
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
- **NodeUtils Refactoring**: Complete rewrite of text wrapping logic with optimized character-level breaking, fallback text measurement, and dynamic node sizing ([nodeUtils.ts](../frontend/src/app/features/mindmap/utils/nodeUtils.ts))

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

