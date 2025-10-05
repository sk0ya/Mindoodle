# 構造再設計（分岐削減）計画（更新版）

本アプリは機能の成長に伴い、各所に条件分岐（ガード）が分散し、保守性と一貫性が低下していました。本ドキュメントは、分岐の集約と責務の明確化を行う再設計方針と、現時点の実装状況・検証手順をまとめた更新版です。

最終更新: 2025-10-05

## 現状の課題
- `MindMapApp.tsx` が入出力（ショートカット・Vim・コマンドパレット・コンテキストメニュー・モーダル）配線と業務ロジックを抱え、分岐が肥大化。
- `uiSlice` に boolean フラグが多く、画面各所で「表示中なら〜しない」といった重複ガードが発生。
- 入力経路（Vim/ショートカット/パレット/メニュー/ボタン）ごとに類似の前提条件チェックが散在。
- キャンバス右クリックや行番号→ノード解決など、仕様分岐が UI コンポーネントに内在。
- 選択/ナビゲーション/可視領域調整のロジックが複数箇所に重複。

## 設計方針（原則）
- 入力の単一路（Command 経由）: あらゆる入力は Command Registry に集約し、ガードはコマンド側で統一。
- モード/パネルの状態機械化: boolean 羅列ではなく、型安全なモード/パネル管理で相互排他・優先度を一元化。
- View と Controller の分離: コンテナは薄い描画主体、ロジックは Controller/Service/Selector に移譲。
- ドメインサービス化: 選択・ナビゲーション・可視化調整・クリップボードなどの重複計算をサービスへ集約。
- セレクタで正規化: ノード探索や行番号→ノード解決は selector 層に統一。

## 新規/移動先のモジュール構成（mindmap）

```
src/app/features/mindmap/
├─ controllers/
│  ├─ MindMapController.ts           # 画面配線・副作用・イベントブリッジ
│  └─ InputController.ts             # 入力集約（Vim/Shortcut/Palette/Menu→Command）
├─ state/
│  ├─ uiModeMachine.ts               # UIMode: 'normal' | 'insert' | 'visual' | 'menu'
│  └─ panelManager.ts                # PanelId 管理（open/close/toggle/closeAll/排他）
├─ services/
│  ├─ NavigationService.ts           # 上下左右/親子/兄弟/空間探索
│  ├─ ViewportService.ts             # ensureVisible/center/パン・ズーム調整
│  ├─ ClipboardService.ts            # ノード/画像/Markdown 貼り付け統一
│  └─ WorkspaceService.ts            # パス分解/順序付け/マップ切替補助
├─ selectors/
│  └─ mindMapSelectors.ts            # findParent/selectByLine/空間探索など
├─ events/
│  ├─ EventStrategy.ts               # モード別戦略のインターフェース/ディスパッチ
│  ├─ CanvasEvent.normal.ts          # Normal 用
│  ├─ CanvasEvent.insert.ts          # Insert 用
│  └─ CanvasEvent.visual.ts          # Visual 用
└─ components/
   └─ Canvas/（CanvasEventHandler は廃止）
      - events/dispatcher.ts が Strategy へのディスパッチを担当

## 現状実装サマリ（導入済み/継続中）

- 入力の単一路（Command 経由）
  - 導入済: `@commands/system/types.ts` に `CommandContext`/`guard` を導入、`@commands/system/registry.ts` の `execute` が guard を考慮して実行
  - 呼び出し統一: `useKeyboardShortcuts`/`useCommandExecution` から `commands.execute(...)` を使用
- モード/パネルの状態機械化
  - 導入済: `@mindmap/state/uiModeMachine.ts` / `@mindmap/state/panelManager.ts`
  - 適用先: `features/mindmap/store/slices/uiSlice.ts` に統合（従来 boolean 羅列は `openPanels` へ漸進移行）
- イベント Strategy 化
  - 導入済: `features/mindmap/events/{CanvasEvent.normal.ts, CanvasEvent.insert.ts, CanvasEvent.visual.ts}` と `events/dispatcher.ts`
- Service 化
  - 導入済: `NavigationService.ts`, `ViewportService.ts`, `ClipboardService.ts`, `EditingStateService.ts` など
- Selector 整備
  - 導入済: `selectors/mindMapSelectors.ts` に親子探索/行番号→ノード解決 等
- Controller 抽出
  - 導入済: `controllers/MindMapController.ts`（認証/Explorer ブリッジ等の配線）。`MindMapApp.tsx` のロジックは段階的に Controller/Service/Selector へ移譲中
- グローバルブリッジの解消
  - 継続中: `useWindowGlobalsBridge.ts` などの window 経由 API は縮退中（段階 7 参照）
```

## Commands の拡張
- `CommandContext` を導入（mode, openPanels, selection, store 参照など）。
- `guard(context) => boolean` を各コマンドに実装し、前提条件ガードを一元化。
- `execute(name, context)` を提供し、入力経路からはこれを呼ぶだけに統一。

## 変更対象と改善観点
- `features/mindmap/components/layout/MindMapApp.tsx`
  - 配線/副作用は `MindMapController` へ移譲しつつ段階的に軽量化。View は props に専念。
  - 右クリックやモーダル開閉は `panelManager`/Strategy 化で一元管理。
  - 行番号→ノード選択は `mindMapSelectors.selectNodeIdByMarkdownLine(...)` に委譲。
- `features/mindmap/components/layout/useShortcutHandlers.ts`
  - ナビ/可視化/クリップボードは `NavigationService`/`ViewportService`/`ClipboardService` に委譲。
  - 実行は `commands.execute(...)`（Command 統一）に置換済（非 Vim/共通ショートカット）。
- `features/mindmap/events/dispatcher.ts`
  - `EventStrategy` によるモード別処理へディスパッチ（`CanvasEventHandler.ts` は廃止）。
- `features/mindmap/store/slices/uiSlice.ts`
  - boolean 羅列を `panelManager`/`uiModeMachine` 内部表現に縮退。相互排他と優先度はここで制御。
- `app/commands/system/*`
  - `types.ts` に `CommandContext`/`guard` を追加済。
  - `registry.ts` は guard 付き `execute` を提供。検索/ヘルプは従来どおり。

## 段階的移行ステップ（低リスク順）と進捗

- [x] 1) Panel/Mode の導入（`uiSlice` に `panelManager`/`uiModeMachine` を実装）
- [x] 2) Command 統一（`CommandContext`/`guard`/`execute` 導入、主要入力経路から `execute` 呼び出しへ）
- [x] 3) Controller 抽出（`MindMapApp.tsx` → `MindMapController` へロジック移行を開始。配線は導入済）
- [x] 4) イベント Strategy 化（Canvas イベントを Normal/Insert/Visual 戦略へ）
- [x] 5) Service 化（Navigation/Viewport/Clipboard/Workspace 等の重複ロジック集約）
- [x] 6) Selector 整備（行番号解決/親子・空間探索の共通化）
- [ ] 7) グローバルブリッジの解消（`useWindowGlobalsBridge` 等の段階的廃止）

### フェーズ7 詳細計画（グローバルブリッジ解消）

目的: `window` 経由の相互作用（例: `mindoodle:selectMapById` などのカスタムイベント、`window.mindoodle*` のグローバル参照）を排除し、型安全なチャンネル（Command/Service/Store/Events）に統合する。

- 背景
  - 現状、`useShortcutHandlers.ts` 内 `switchToPrevMap`/`switchToNextMap` で `CustomEvent('mindoodle:selectMapById', ...)` を dispatch
  - `useWindowGlobalsBridge.ts` にて Explorer/Map 連携や外部起動ブリッジを提供
  - これらは SSR/将来の埋め込み/テストに不利で、型安全性も下がる

- 実施ステップ（順序）
  1) 代替 API の提供
     - Command: `application.switch-map --direction prev|next` を `@commands/application/mindmap.ts` に追加
     - Service: `WorkspaceService.switchToAdjacentMap(direction)` を mindmap services に追加
     - Events: 既存 `@core/streams/mindMapEvents` に map 変更系の発火/購読を集約
  2) 呼び出し元の置換
     - `useShortcutHandlers.ts`: `switchToPrevMap`/`switchToNextMap` を Command 経由に差し替え
     - `MindMapApp.tsx`: `useWindowGlobalsBridge` の Explorer 関連を Controller/Service へ移譲
  3) 段階的フラグ（移行中の安全策）
     - `store.settings.enableWindowBridgeFallback?: boolean`（既定: false）を導入し、問題発生時の一時的な後方互換を許可
  4) デッドコード削除
     - `useWindowGlobalsBridge.ts` の機能を最小化の後、削除
     - `window.mindoodle*` 系参照を全検索し除去

- インターフェイス契約（要件）
  - Command: `switch-map`
    - シグネチャ: `execute(context, { direction?: 'prev'|'next', mapId?: string, workspaceId?: string })`
    - 優先順: `mapId` 指定 > `direction` 指定 > エラー
    - Guard: 編集中は許可（選択ノード非依存）
  - Service: `WorkspaceService.switchToAdjacentMap(direction)`
    - 空マップスキップ等のビジネスロジックを内包（現状ロジックの移行）

- 受け入れ基準（Definition of Done）
  - `git grep -n "mindoodle:selectMapById"` が 0 件
  - `git grep -n "window\.mindoodle"` が 0 件
  - Ctrl+P/N（prev/next）の挙動が従来と同等（空マップはスキップ）
  - `npm run type-check` が成功（strict は別トラックで改善）
  - `npm run build` が成功し、プレビューでマップ切替が機能

- 検証シナリオ（手動）
  - 通常ショートカット: Ctrl+P/N の連打、空マップ/非空マップ混在で期待通り遷移
  - Command Palette: `switch-map` 実行で ID 指定/方向指定が動作
  - Vim 有効/無効の両モードでナビに干渉しない
  - 既存 Link ナビゲーション（Map/Node/Anchor）は影響なし

- ロールバック手順（万一の不具合時）
  - `store.settings.enableWindowBridgeFallback = true` で一時的に旧ブリッジを復活
  - 影響範囲を限定するため、Command/Service 実装は維持したまま呼び出しのみ切り戻し

---

### 型安全ゲート（現状と改善計画）

現状、`npm run type-check:strict` は多数の `exactOptionalPropertyTypes` 起因のエラーが存在。短期は標準 `type-check` をパス対象とし、中期で strict 化を完了する。

- 短期（Baseline 固定）
  - `npm run type-check` を CI/PR の必須チェックに維持
  - `build` では `validate` のみをゲート（現状仕様）

- 中期（Strict 対応）— 推奨順序
  1) `shared/types` と `core/storage`（エラー少・波及多）
  2) `features/mindmap/utils` と `selectors`（値チェック追加）
  3) `markdown/**`（パーサ周りの undefined 扱いの整理）
  4) `nodeSlice/historySlice`（`undefined` を許容しない型へ修正）

- 対応パターン指針
  - `T | undefined` を公開型で返さない（呼び出し側にガード負担を与えない）
  - exactOptionalPropertyTypes 下では `prop?: T` に `undefined` をそのまま渡さない
  - `fetch` の `RequestInit` は `headers?: HeadersInit` で、`undefined` の場合はプロパティ自体を省略

---

### タスク一覧（トラッキング）

- [ ] Command: `application/switch-map` 追加（args: `direction?`, `mapId?`, `workspaceId?`）
- [ ] Service: `WorkspaceService.switchToAdjacentMap` 実装（空マップの判定を移管）
- [ ] `useShortcutHandlers` の `switchToPrev/NextMap` を Command 経由へ置換
- [ ] `useWindowGlobalsBridge` の Explorer/Map 連携を Controller/Service 経由に移譲
- [ ] `window.mindoodle*` 参照を全除去
- [ ] QA シナリオ実施と結果記録（このドキュメントに貼付）

担当/予定

- Owner: （記入）
- Target: （記入）

## 期待効果
- 分岐削減・一貫性向上・テスト容易性・変更影響の局所化。

## 実装メモ（型とスタイル）
- Strict TS 維持。`UIMode`/`PanelId` は判別可能ユニオン。
- 既存のパスエイリアスと `src/app/index.ts` の再エクスポート方針を維持。
- `commands` 構成を踏襲し guard/execute のみ拡張。

## 実体参照（主なファイル）

- Mindmap 機能配下: `frontend/src/app/features/mindmap/**`
  - Controller: `controllers/MindMapController.ts`
  - Events: `events/{CanvasEvent.normal.ts, CanvasEvent.insert.ts, CanvasEvent.visual.ts, dispatcher.ts}`
  - Services: `services/{NavigationService.ts, ViewportService.ts, ClipboardService.ts, EditingStateService.ts}`
  - State: `state/{uiModeMachine.ts, panelManager.ts}` / Store: `store/slices/uiSlice.ts`
  - Selectors: `selectors/mindMapSelectors.ts`
  - Shortcuts: `components/layout/useShortcutHandlers.ts`, `hooks/useKeyboardShortcuts.ts`, `hooks/useCommandExecution.ts`
- Command System: `frontend/src/app/commands/**`
  - Registry: `system/registry.ts` / Types: `system/types.ts`

## 検証・実行手順（frontend/ 直下で実行）

1) 型チェック（厳密）: `npm run type-check:strict`
2) Lint: `npm run lint`
3) ドキュメント生成: `npm run docs:generate`（`docs/shortcuts.md`, `docs/vim-keybindings.md` を再生成）
4) ビルド: `npm run build`
5) プレビュー（任意）: `npm run preview`（Vite preview）

リポジトリ ガイドラインに従い、開発は `frontend/` ディレクトリ内で行い、Path Alias（`@`, `@shared`, `@local`）および `src/app/index.ts` の集約エクスポートを維持してください。
