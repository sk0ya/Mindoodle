# Mindoodle

**🌐 オンライン版**: https://sk0ya.github.io/Mindoodle/

**概要**
- Mindoodle は「Markdown ベースのローカル専用マインドマップ」アプリです。ブラウザの File System Access API を使い、選択したフォルダ直下にマインドマップを Markdown (`.md`) として保存・読み書きします。
- フロントエンドのみで動作するローカルファースト設計。Vite + React + TypeScript（strict）で実装されています。
- ブラウザから直接利用可能（インストール不要）、File System Access API を使用してローカルフォルダへの保存が可能

**主な機能**
- マインドマップ編集: ノードの追加/削除/移動、兄弟順序変更、折りたたみ、ドラッグ操作、パン/ズーム。
- Markdown 連携: ノード構造 ↔ Markdown の双方向同期（Monaco エディタのノート/Markdown パネル）。
- リンクと添付: ノードのノート欄に、他マップ/他ノード/ファイルへの相対リンクを挿入可能。
- ワークスペース: 複数フォルダを「ワークスペース」として登録・切替（ブラウザ権限が必要）。
- Vim ライク操作: `h/j/k/l` などで高速ナビゲーション、`dd`、`za` 等のコマンド。
- 履歴管理: Undo/Redo。
- AI 支援（任意）: Ollama と連携して子ノード候補を生成。

**技術スタック**
- フレームワーク: `React 18.2`, `Vite 6.3`
- 言語/型: `TypeScript 5.8`（strict）
- 状態管理: `Zustand 5.0` + `Immer 10.1`
- エディタ: `Monaco Editor 0.52` + `Monaco Vim 0.4`
- 解析/変換: `Marked 16.2`（Markdown）、独自パーサ/エクスポータ
- ファイル処理: `JSZip 3.10`
- UI/アイコン: `Lucide React 0.544`

**キーボードショートカット（抜粋）**
- 移動: `↑/↓/←/→`（または `h/j/k/l`）
- 追加: `Enter` 兄弟, `Tab` 子
- 編集: `Space` または `F2`（開始）
- 削除: `Delete` / `Backspace`
- 履歴: `Ctrl+Z` Undo, `Ctrl+Shift+Z`/`Ctrl+Y` Redo
- 保存: `Ctrl+S`
- Vim 系: `dd` 削除, `za` 折りたたみ, `zz` 中央表示, `i/a/o` 編集/挿入

**AI 連携（Ollama）**
- 任意機能。`frontend/src/app/core/services/ollamaService.ts` によるローカル Ollama API 接続を想定します。
- 拡張機能（`window.MindFlowOllamaBridge`）がある場合はそちらを優先して通信します。
- 使い方（概略）
  - 設定で `Ollama URL` と `model` 等を指定
  - ノードのコンテキストメニューから「AI 子ノード生成」を実行

**セキュリティ/設計上の注意**
- ネットワーク呼び出しは原則不要（ローカルファースト）。AI 連携のみローカル Ollama を想定。
- 入力検証を徹底し、未検証の `JSON.parse` は使用しません（検出スクリプトあり）。

**ライセンス**
- MIT