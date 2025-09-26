# Mindoodle

**🌐 オンライン版**: <https://sk0ya.github.io/Mindoodle/>

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

**ライセンス**

- MIT

**ドキュメント**

- Vim キーバインド早見表: docs/vim-keybindings.md
- 通常ショートカット早見表: docs/shortcuts.md
