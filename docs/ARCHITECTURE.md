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
```

### Path Aliases (Vite + TS)

- `@` → `src/`
- `@shared` → `src/app/shared/`

### Architecture Patterns

- Modular exports via `src/app/index.ts`.
- Command-driven core under `src/app/commands/` grouped by domain.
- Feature-based organization: each feature has `services`, `hooks`, `components`, `store`, `types`.
- Zustand store per feature; mindmap store uses slice pattern.
- Hybrid storage: local-first with optional cloud adapter.
  - Local: File System Access API or IndexedDB (MarkdownFolderAdapter)
  - Cloud: Cloudflare Workers + KV + R2 (CloudStorageAdapter)

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

