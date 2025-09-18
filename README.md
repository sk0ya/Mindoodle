**概要**
- Mindoodle は「Markdown ベースのローカル専用マインドマップ」アプリです。ブラウザの File System Access API を使い、選択したフォルダ直下にマインドマップを Markdown (`.md`) として保存・読み書きします。
- フロントエンドのみで動作するローカルファースト設計。Vite + React + TypeScript（strict）で実装されています。

**主な機能**
- マインドマップ編集: ノードの追加/削除/移動、兄弟順序変更、折りたたみ、ドラッグ操作、パン/ズーム。
- Markdown 連携: ノード構造 ↔ Markdown の双方向同期（Monaco エディタのノート/Markdown パネル）。
- リンクと添付: ノードのノート欄に、他マップ/他ノード/ファイルへの相対リンクを挿入可能。
- ワークスペース: 複数フォルダを「ワークスペース」として登録・切替（ブラウザ権限が必要）。
- Vim ライク操作: `h/j/k/l` などで高速ナビゲーション、`dd`、`za` 等のコマンド。
- 履歴管理: Undo/Redo。
- AI 支援（任意）: Ollama と連携して子ノード候補を生成。

**技術スタック**
- フレームワーク: `React 18`, `Vite 6`
- 言語/型: `TypeScript 5`（strict）
- 状態管理: `zustand` + `immer`
- エディタ: `monaco-editor`, `@monaco-editor/react`
- 解析/変換: `marked`（Markdown）、独自パーサ/エクスポータ
- UI/アイコン: `lucide-react`

**プロジェクト構成**
- ルート: この README と開発ドキュメント。
- アプリ本体: `frontend/`
  - エントリ: `frontend/src/main.tsx`, `frontend/src/App.tsx`
  - モジュール: `frontend/src/app/{core,features,shared,...}`（集約エクスポートは `src/app/index.ts`）
  - 共有ユーティリティ: `frontend/src/shared/**`
  - 公開アセット: `frontend/public/`（ビルド出力は `frontend/dist/`）
  - パスエイリアス: `@ -> src`, `@shared -> src/shared`, `@local* -> src/Local/*`

**ローカル開発**
- 前提: Node.js 18+ / npm
- 初回セットアップ（`frontend/` 内で実行）
  - `npm install`
- コマンド（すべて `frontend/` で）
  - `npm run dev` 開発サーバ起動（ポート `5174` 固定）
  - `npm run build` 型安全ゲートを通して `dist/` へビルド
  - `npm run preview` ビルド成果物のローカルプレビュー
  - `npm run type-check` / `type-check:strict` TypeScript チェック（no emit）
  - `npm run lint` / `lint:fix` ESLint 実行
  - `npm run scan:unsafe` 危険パターン検出スクリプト（`any`, 強制 `!`, 未検証 `JSON.parse` 等）

**初回の使い方**
- アプリを起動（`npm run dev`）→ ブラウザで `http://localhost:5174`。
- 画面左の UI から「ワークスペース（フォルダ）を選択」。ブラウザの許可ダイアログで「読み書き」を許可します。
- 既存の `*.md` をスキャンし、見出し構造からマインドマップを復元します。なければ新規マップを作成します。
- ノード選択後、`Enter` で兄弟ノード、`Tab` で子ノードを追加。Space/F2 で編集開始、`Delete/Backspace` で削除。
- ノートパネル（Markdown）はノード構造と双方向同期。ノートに `[リンク](相対パスや#アンカー)` を挿入できます。

**キーボードショートカット（抜粋）**
- 移動: `↑/↓/←/→`（または `h/j/k/l`）
- 追加: `Enter` 兄弟, `Tab` 子
- 編集: `Space` または `F2`（開始）
- 削除: `Delete` / `Backspace`
- 履歴: `Ctrl+Z` Undo, `Ctrl+Shift+Z`/`Ctrl+Y` Redo
- 保存: `Ctrl+S`
- Vim 系: `dd` 削除, `za` 折りたたみ, `zz` 中央表示, `i/a/o` 編集/挿入

**Markdown とファイル保存仕様（要点）**
- 保存先は選択したワークスペースフォルダ配下。マップは `カテゴリー/タイトル.md` のように保存されます。
- ノード構造は Markdown の見出し/リストとして表現。ノートのテキストは該当ノード配下に保持されます。
- 他マップ/他ノードへのリンクは相対パス + アンカー（例: `../TopicB.md#見出し`）。
- 大半の処理は `MarkdownFolderAdapter`（File System Access API）で実装されています。

**AI 連携（Ollama）**
- 任意機能。`frontend/src/app/core/services/ollamaService.ts` によるローカル Ollama API 接続を想定します。
- 拡張機能（`window.MindFlowOllamaBridge`）がある場合はそちらを優先して通信します。
- 使い方（概略）
  - 設定で `Ollama URL` と `model` 等を指定
  - ノードのコンテキストメニューから「AI 子ノード生成」を実行

**ビルドとホスティング**
- `vite.config.js` の `base` は `'/Mindoodle/'` に設定。GitHub Pages 等で `https://<user>.github.io/Mindoodle/` のように配信できます。
- 静的配信時も File System Access API（権限付与後）でローカルフォルダに保存できます。

**コーディング規約（抜粋）**
- TypeScript strict。`any` や強制 `!`、未検証の型アサーション/`JSON.parse` を避けます。
- React 関数コンポーネント、2 スペースインデント、ESM。
- 主要エイリアスとエクスポート集約は `src/app/index.ts` を尊重。
- Lint: ESLint（`@typescript-eslint`, `react`, `react-hooks`）。

**セキュリティ/設計上の注意**
- ネットワーク呼び出しは原則不要（ローカルファースト）。AI 連携のみローカル Ollama を想定。
- 入力検証を徹底し、未検証の `JSON.parse` は使用しません（検出スクリプトあり）。

**よくあるトラブル**
- フォルダが読み書きできない: ブラウザの File System Access API 権限を再付与してください（フォルダ再選択）。
- 既存 Markdown が読み込めない: 最上位の見出しが無い/非対応レイアウトの場合があります。見出しを付与してから再読み込みしてください。
- Vim キーが効かない: フォーカスがエディタ/入力欄にある場合はショートカットを抑制します。

**ライセンス**
- MIT

