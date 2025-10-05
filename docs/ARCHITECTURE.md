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

### Recent Architecture Improvements (2025-10)

- **Command-driven Input**: Unified all input sources (keyboard, vim, palette, context menu) through Command Registry.
- **Event Strategy Refactoring**: Replaced `CanvasEventHandler` with mode-based strategies for cleaner separation.
- **Controller Extraction**: Moved business logic from `MindMapApp.tsx` to `MindMapController` and services.
- **Global Bridge Elimination**: Replaced `window.mindoodle*` and CustomEvents with typed Command/Service APIs.
- **Layout Reorganization**: Restructured components into `common/overlay/panel/sidebar` subdirectories.

### Key Technologies

- Frontend: React 18 + TypeScript 5 + Vite 6
- State: Zustand + Immer
- Editor: Monaco + monaco-vim
- File handling: JSZip for import/export
- Markdown: Marked
- Diagrams: Mermaid
- Icons: Lucide React
- Backend (optional): Cloudflare Workers with KV and R2

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

