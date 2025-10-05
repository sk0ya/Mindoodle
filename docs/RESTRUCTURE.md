# 構造再設計（分岐削減）計画

本アプリは機能の成長に伴い、各所に条件分岐（ガード）が分散し、保守性と一貫性が低下しています。以下の方針で構造を再設計し、分岐の集約と責務の明確化を行います。

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
   └─ Canvas/CanvasEventHandler.ts   # Strategy ディスパッチのみの薄型へ
```

## Commands の拡張
- `CommandContext` を導入（mode, openPanels, selection, store 参照など）。
- `guard(context) => boolean` を各コマンドに実装し、前提条件ガードを一元化。
- `execute(name, context)` を提供し、入力経路からはこれを呼ぶだけに統一。

## 変更対象と改善観点
- `features/mindmap/components/layout/MindMapApp.tsx`
  - 配線/副作用は `MindMapController` へ移譲。View は props に専念。
  - 右クリックの表示可否は `panelManager.canOpen('contextMenu', { exclusiveWith: ['linkList'] })` で一元化。
  - 行番号→ノード選択は `mindMapSelectors.selectNodeIdByMarkdownLine(...)` に委譲。
- `features/mindmap/components/layout/useShortcutHandlers.ts`
  - ナビ/可視化/クリップボードは `NavigationService`/`ViewportService`/`ClipboardService` に移譲。
  - 実行は `dispatchCommand`（Command 統一）に置換。
- `features/mindmap/components/Canvas/CanvasEventHandler.ts`
  - `EventStrategy` によるモード別処理へ切替（分岐削減）。
- `features/mindmap/store/slices/uiSlice.ts`
  - boolean 羅列を `panelManager`/`uiModeMachine` 内部表現に縮退。相互排他と優先度はここで制御。
- `app/commands/system/*`
  - `types.ts` に `CommandContext`/`guard` を追加。
  - `registry.ts` は guard 付き `execute` を提供。検索/ヘルプは従来どおり。

## 段階的移行ステップ（低リスク順）
1) Panel/Mode の導入（uiSlice に panelManager/uiModeMachine を実装）
2) Command 統一（CommandContext/guard/execute 導入、入力経路からは execute 呼び出しへ）
3) Controller 抽出（MindMapApp.tsx → MindMapController へロジック移行）
4) イベント Strategy 化（Canvas イベントを Normal/Insert/Visual 戦略へ）
5) Service 化（Navigation/Viewport/Clipboard/Workspace の重複ロジック集約）
6) Selector 整備（行番号解決/親子・空間探索の共通化）
7) グローバルブリッジの解消（window 経由 API の排除）

## 期待効果
- 分岐削減・一貫性向上・テスト容易性・変更影響の局所化。

## 実装メモ（型とスタイル）
- Strict TS 維持。`UIMode`/`PanelId` は判別可能ユニオン。
- 既存のパスエイリアスと `src/app/index.ts` の再エクスポート方針を維持。
- `commands` 構成を踏襲し guard/execute のみ拡張。

