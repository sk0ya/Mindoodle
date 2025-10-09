# Mindoodleリファクタリング計画

## 概要

このドキュメントは、Mindoodleプロジェクトにおけるロジックの重複削減を目的としたリファクタリング計画を記述します。

**目標**: コードの重複を30-40%削減し、保守性を大幅に向上させる

**期間**: 4-8日（フェーズ1-2は優先実施）

## 現状分析

### 発見された主要な問題

#### 1. Utils層の分散と重複
- **ノード操作ロジックの分散**
  - `shared/utils/`: validation（validateMindMapNode）, navigation（findNodeBySpatialDirection）
  - `mindmap/utils/nodeTreeUtils.ts`: findNodeById, findNodePathById, updateNodeInTree等（8個以上の関数）
  - `mindmap/utils/nodeUtils.ts`: getNode*系の関数が20個以上

- **パス操作の重複**
  - `shared/utils/stringUtils.ts`: getLastPathSegment, getParentPath, getDirectoryPath, getPathDepth
  - `shared/utils/folderUtils.ts`: parseFolderPath, getParentFolderPath, getFolderName

- **searchUtils.tsの重複**
  - `shared/utils/searchUtils.ts`: findNodeByLineNumber, getMatchPosition
  - `mindmap/utils/searchUtils.ts`: getAncestorNodeIds, getDescendantNodeIds

#### 2. Hooks層の複雑性
- **useMindMap系フックが20個以上存在**
  - useMindMapData, useMindMapUI, useMindMapActions, useMindMapPersistence等
  - 依存関係が複雑で、メンテナンスが困難

- **sidebar系フックの分散**
  - sidebar.mapOps, sidebar.folderOps, sidebar.contextMenu, sidebar.filtering, sidebar.explorerTree
  - 5個のファイルに分散しており、統合が可能

#### 3. イベント処理の分散
- **addEventListener呼び出しの重複**
  - 19個のファイルで合計38箇所
  - イベントリスナーの登録/解除パターンが各所で重複

- **イベントユーティリティの分散**
  - `shared/utils/eventUtils.ts`: 汎用イベントヘルパー
  - `handlers/BaseEventHandler.ts`: イベントハンドリング用の基底フック
  - `handlers/BaseDragHandler.ts`: ドラッグ用の基底フック

#### 4. Services層の命名の混乱
- **ViewportService**: `core/services/`と`mindmap/services/`の両方に存在（機能は異なる）
- **ClipboardService**: `shared/utils/clipboard.ts`と`mindmap/services/ClipboardService.ts`
- **NavigationService**: `shared/utils/navigation.ts`と`mindmap/services/NavigationService.ts`

## リファクタリング計画

### フェーズ1: Utils層の整理 ⭐ 高優先度

**期間**: 1-2日
**リスク**: 低（主に内部関数の移動）
**影響**: 中（importパスの変更のみ）
**価値**: 高（コードの見通しが大幅改善）

#### ステップ1.1: ノード操作ユーティリティの統合

**目標**: ノード関連の関数をmindmap/utilsに集約

```
タスク:
1. mindmap/utils/nodeOperations.ts を新規作成
2. 以下を統合:
   - nodeTreeUtils.ts の全関数
   - shared/utils/navigation.ts の findNodeBySpatialDirection
   - shared/utils/validation.ts の validateMindMapNode
3. 既存ファイルから関数を移動
4. import パスを全体的に更新
5. テスト実行で動作確認
```

**移動対象の関数**:
- `findNodeById` (nodeTreeUtils)
- `findNodePathById` (nodeTreeUtils)
- `updateNodeInTree` (nodeTreeUtils)
- `findParentNode` (nodeTreeUtils)
- `getSiblingNodes` (nodeTreeUtils)
- `getFirstVisibleChild` (nodeTreeUtils)
- `findNodeInRoots` (nodeTreeUtils)
- `findNodeInData` (nodeTreeUtils)
- `findNodeBySpatialDirection` (navigation)
- `validateMindMapNode` (validation)

#### ステップ1.2: パス操作の統合

**目標**: パス関連関数をfolderUtilsに集約

```
タスク:
1. shared/utils/folderUtils.ts を確認
2. stringUtils.ts から以下を移動:
   - getLastPathSegment
   - getParentPath
   - getDirectoryPath
   - getPathDepth
3. folderUtils で再エクスポート
4. stringUtils から削除（または非推奨マーク）
5. import パスを更新
```

#### ステップ1.3: searchUtils の整理

**目標**: 役割を明確化し、必要なら統合

```
タスク:
1. 両方の searchUtils.ts を比較
2. 機能が異なる場合:
   - mindmap/utils/searchUtils.ts を mindmap/utils/nodeSearch.ts にリネーム
3. 重複がある場合:
   - 統合して共通化
```

#### 成功基準
- [ ] ノード操作関数がmindmap/utilsに集約
- [ ] パス操作関数がfolderUtilsに集約
- [ ] searchUtilsの役割が明確
- [ ] すべてのビルドが成功（`npm run build`）
- [ ] 型チェックが成功（`npm run type-check`）
- [ ] リント警告なし（`npm run lint`）
- [ ] 手動テストで基本機能が動作

---

### フェーズ2: Services層の命名整理 ⭐ 高優先度

**期間**: 0.5-1日
**リスク**: 低（リネームが主）
**影響**: 小（importパスの変更のみ）
**価値**: 中（混乱の解消）

#### タスク

```
1. ViewportService (mindmap) を ViewportScrollService にリネーム
   - mindmap/services/ViewportService.ts → ViewportScrollService.ts
   - ensureVisible 関数の役割を明確化

2. ClipboardService (mindmap) を NodeClipboardService にリネーム
   - mindmap/services/ClipboardService.ts → NodeClipboardService.ts
   - ノードのクリップボード操作に特化していることを明示

3. NavigationService (mindmap) を NodeNavigationService にリネーム
   - mindmap/services/NavigationService.ts → NodeNavigationService.ts
   - ノード間のナビゲーションに特化していることを明示

4. 全 import パスを更新
5. 型定義も合わせて更新
```

#### 成功基準
- [ ] Service名が役割を明確に反映
- [ ] 命名の衝突が解消
- [ ] 全importパスが正しく更新
- [ ] ビルド・型チェック・リント成功

---

### フェーズ3: イベント処理の中央集約 🔶 中優先度

**期間**: 2-3日
**リスク**: 中（イベント処理の変更）
**影響**: 大（多数のコンポーネントに影響）
**価値**: 高（38箇所の重複削減）

#### ステップ3.1: useEventListenerフックの作成

**目標**: イベントリスナー管理を統合

```typescript
// shared/hooks/system/useEventListener.ts
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: {
    target?: Window | Document | HTMLElement | null;
    capture?: boolean;
    passive?: boolean;
    enabled?: boolean;
  }
): void {
  // Implementation
}
```

#### ステップ3.2: 既存のaddEventListenerを置き換え

**対象**: 19個のファイル、38箇所

```
タスク:
1. useEventListener を実装
2. 各コンポーネントで以下のパターンを置き換え:

   Before:
   useEffect(() => {
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [handleClickOutside]);

   After:
   useEventListener('mousedown', handleClickOutside, {
     target: document,
     enabled: true
   });
```

**対象ファイル**:
- useKeyboardShortcuts.ts
- MindMapController.ts
- useMindMapEvents.ts
- SelectedNodeNotePanel.tsx
- NodeNotesPanel.tsx
- KeyboardShortcutHelper.tsx
- BaseDragHandler.ts
- VimMappingsEditor.tsx
- AISidebar.tsx
- SettingsSidebar.tsx
- ContextMenu.tsx (2箇所)
- MindMapApp.tsx
- ImageModal.tsx
- LinkActionMenu.tsx
- CanvasViewportHandler.ts
- NodeRenderer.tsx
- CanvasRenderer.tsx
- KnowledgeGraphModal2D.tsx

#### ステップ3.3: イベント処理パターンの標準化

```
タスク:
1. BaseEventHandler と BaseDragHandler の利用推進
2. 共通パターンを抽出
3. ドキュメント化
```

#### 成功基準
- [ ] useEventListenerフックが実装され、テスト済み
- [ ] 38箇所のaddEventListenerが置き換え完了
- [ ] イベント処理の標準パターンがドキュメント化
- [ ] ビルド・型チェック・リント成功
- [ ] イベント処理が正常に動作

---

### フェーズ4: Hooks層の簡素化 🔷 低優先度（長期）

**期間**: 3-5日
**リスク**: 高（状態管理の中核）
**影響**: 大（全体的なアーキテクチャ変更）
**価値**: 高（保守性の大幅改善）

#### ステップ4.1: Sidebar関連フックの統合

**目標**: sidebar.*系の5個のフックを統合

```typescript
// Before: 5個のファイル
- sidebar.mapOps.ts
- sidebar.folderOps.ts
- sidebar.contextMenu.tsx
- sidebar.filtering.ts
- sidebar.explorerTree.ts

// After: 1個のファイル
- useSidebar.ts (または useSidebarFeatures.ts)
```

**実装方針**:
```typescript
export function useSidebar(config: SidebarConfig) {
  const mapOps = useMapOperations();
  const folderOps = useFolderOperations();
  const contextMenu = useContextMenu();
  const filtering = useFiltering();
  const explorerTree = useExplorerTree();

  return {
    mapOps,
    folderOps,
    contextMenu,
    filtering,
    explorerTree
  };
}
```

#### ステップ4.2: MindMap関連フックの階層化

**現状**: 20個以上のuseMindMap*系フック

**改善案**:
```
useMindMap (最上位統合フック)
├── useMindMapData
├── useMindMapUI
├── useMindMapActions
├── useMindMapPersistence
└── Feature Group Hooks
    ├── useEditingFeatures (編集機能)
    │   ├── useEditingState
    │   ├── useMarkdownOperations
    │   └── useMindMapClipboard
    ├── useNavigationFeatures (ナビゲーション機能)
    │   ├── useMindMapViewport
    │   └── useKeyboardShortcuts
    ├── useDataFeatures (データ管理)
    │   ├── useMindMapFileOps
    │   └── useMindMapPersistence
    └── useAIFeatures (AI機能)
        └── useAIOperations
```

#### 成功基準
- [ ] sidebar関連フックが統合
- [ ] MindMap関連フックが階層化
- [ ] フック間の依存関係が明確
- [ ] ビルド・型チェック・リント成功
- [ ] 全機能が正常に動作

---

## 実装順序

**推奨順序**: フェーズ1 → フェーズ2 → フェーズ3 → フェーズ4

### 理由
1. **フェーズ1-2（高優先度）**: 低リスク・高価値で即座に実施可能
2. **フェーズ3（中優先度）**: 影響範囲が大きいが、効果も高い
3. **フェーズ4（低優先度）**: リスクが高いため、他のフェーズ完了後に慎重に実施

## 全体の成功指標

### 定量的指標
- **ファイル数削減**: 10-15%削減目標
- **コード重複**: 30-40%削減目標
- **import文の長さ**: 平均20%短縮
- **保守性指標**: Cyclomatic Complexity削減

### 定性的指標
- コードの見通しが改善
- 新規開発者のオンボーディング時間短縮
- バグ修正時間の短縮
- 機能追加時の影響範囲が明確化

## リスク軽減策

### リスク1: 破壊的変更

**軽減策**:
- Git feature branchで作業
- 各ステップごとにコミット
- ビルド・型チェック・リントを頻繁に実行
- 問題があれば即座にロールバック

### リスク2: import パスの更新漏れ

**軽減策**:
- TypeScriptの型チェックに依存
- Grep/Find-and-replaceで全箇所更新
- IDEのリファクタリング機能を活用（VSCodeのRename Symbol等）

### リスク3: テスト不足

**軽減策**:
- 各フェーズ後に手動テスト
- 主要ユースケースの確認リスト作成
  - [ ] マインドマップの作成
  - [ ] ノードの追加・編集・削除
  - [ ] マークダウンエクスポート/インポート
  - [ ] キーボードショートカット
  - [ ] サイドバーの操作
  - [ ] ファイル保存/読み込み
- 問題発見時は即座に対応

## 実装チェックリスト

### フェーズ1開始前
- [ ] feature branchを作成 (`git checkout -b refactor/utils-consolidation`)
- [ ] 現在の状態をコミット
- [ ] ビルド・型チェック・リントが成功することを確認

### フェーズ1実装中
- [ ] ステップ1.1: ノード操作の統合完了
- [ ] ステップ1.2: パス操作の統合完了
- [ ] ステップ1.3: searchUtilsの整理完了
- [ ] 各ステップ後にビルド・型チェック実行
- [ ] 各ステップ後にコミット

### フェーズ1完了後
- [ ] すべての成功基準をクリア
- [ ] 手動テスト実施
- [ ] PRを作成してレビュー
- [ ] マージ

### フェーズ2以降
- 同様のチェックリストを各フェーズごとに作成

## 参考資料

- [プロジェクト概要](/home/koya/projects/web/Mindoodle/docs/ARCHITECTURE.md)
- [コーディング規約](/home/koya/projects/web/Mindoodle/CLAUDE.md)
- [ロードマップ](/home/koya/projects/web/Mindoodle/docs/ROADMAP.md)

## 更新履歴

- 2025-10-09: 初版作成
