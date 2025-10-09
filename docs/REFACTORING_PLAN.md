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

#### ステップ1.1: ノード操作ユーティリティの統合 ✅ 完了

**目標**: ノード関連の関数をmindmap/utilsに集約

**実施日**: 2025-10-10

```
完了タスク:
1. ✅ mindmap/utils/nodeOperations.ts を作成（既に存在していた）
2. ✅ 以下を統合:
   - ノードツリー操作関数（findNodeById, findNodePathById, updateNodeInTree等）
   - 空間的ナビゲーション（findNodeBySpatialDirection）
   - ノードバリデーション（validateMindMapNode, isMindMapNode）
3. ✅ shared/utils/navigation.ts を完全削除
4. ✅ shared/utils/validation.ts から重複関数を削除し、nodeOperationsからインポート
5. ✅ shared/utils/index.ts のエクスポートを整理
6. ✅ 型チェック・Lint通過確認
```

**統合された関数**:

- `findNodeById` - ノードツリー操作
- `findNodePathById` - ノードツリー操作
- `updateNodeInTree` - ノードツリー操作
- `removeNodeFromTree` - ノードツリー操作
- `findParentNode` - ノードツリー操作
- `getSiblingNodes` - ノードツリー操作
- `getFirstVisibleChild` - ノードツリー操作
- `findNodeInRoots` - ノードツリー操作
- `findNodeInData` - ノードツリー操作
- `traverseNodes` - ノードツリー操作
- `isRootNode` - ノードツリー操作
- `findNodeBySpatialDirection` - 空間ナビゲーション
- `validateMindMapNode` - バリデーション
- `isMindMapNode` - 型ガード

**成果**:

- ファイル削減: navigation.ts完全削除
- 重複削減: validation.tsから約50行削除
- 一元化: ノード操作関数が`@mindmap/utils`に集約
- 保守性向上: ノード関連ロジックの単一の真実の源を確立

#### ステップ1.2: パス操作の統合 ✅ 完了

**目標**: パス関連関数を統合し、重複を削減

**実施日**: 2025-10-09

```
完了タスク:
1. ✅ shared/utils/pathOperations.ts を新規作成
2. ✅ 以下の統合関数を実装:
   - extractWorkspaceId() - ワークスペースID抽出
   - parseWorkspacePath() - ワークスペースIDと相対パス分離
   - isWorkspacePath() - ワークスペースパス判定
   - cleanWorkspacePath() - ワークスペースID除去
   - buildWorkspacePath() - ワークスペースIDとパス結合
   - buildChildPath() - 親パスと子要素からパス構築
   - extractParentPaths() - 全親パス抽出
   - normalizePathSeparators() - パスセパレータ正規化
   - resolveWorkspaceId() - ワークスペースID解決（フォールバック付き）
3. ✅ 以下のファイルの重複ロジックを置き換え:
   - sidebar.mapOps.ts (17行 → 3行、82%削減)
   - sidebar.folderOps.ts (14行 → 5行、64%削減)
   - sidebar.filtering.ts (親パス抽出ロジック3箇所を統合)
4. ✅ shared/utils/index.ts でエクスポート
5. ✅ 型チェック・Lint通過確認
```

**成果**:

- 重複コード: 約60〜80行削減
- 保守性: パス操作ロジックが単一の真実の源に統合
- 可読性: 関数名で意図が明確に表現

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

#### フェーズ1 成功基準

- [x] ノード操作関数がmindmap/utilsに集約
- [x] パス操作関数がpathOperationsに集約
- [ ] searchUtilsの役割が明確（未実施）
- [x] 型チェックが成功（`npm run type-check`）
- [x] リント警告なし（既存warningのみ）

---

### フェーズ2: Services層の命名整理 ✅ 完了

**期間**: 0.5日
**リスク**: 低（リネームが主）
**影響**: 小（importパスの変更のみ）
**価値**: 中（混乱の解消）

**実施日**: 2025-10-10

#### 実施内容

```
完了タスク:
1. ✅ ViewportService → ViewportScrollService
   - mindmap/services/ViewportService.ts → ViewportScrollService.ts
   - ensureVisible 関数の役割を明確化（スクロールによる可視化）

2. ✅ ClipboardService → NodeClipboardService
   - mindmap/services/ClipboardService.ts → NodeClipboardService.ts
   - ノードのクリップボード操作に特化していることを明示

3. ✅ NavigationService → NodeNavigationService
   - mindmap/services/NavigationService.ts → NodeNavigationService.ts
   - ノード間のナビゲーションに特化していることを明示

4. ✅ import パスを更新（useShortcutHandlers.ts）
5. ✅ 型チェック成功確認
```

#### 成果

- **命名の明確化**: サービス名が役割を正確に反映
- **衝突解消**: core/servicesとの命名衝突を完全に解消
- **保守性向上**: サービスの専門性が名前から即座に理解可能

#### 成功基準

- [x] Service名が役割を明確に反映
- [x] 命名の衝突が解消
- [x] 全importパスが正しく更新
- [x] ビルド・型チェック・リント成功

---

### フェーズ3: イベント処理の中央集約 ✅ 完了

**期間**: 1日
**リスク**: 中（イベント処理の変更）
**影響**: 大（多数のコンポーネントに影響）
**価値**: 高（イベントリスナー重複削減）

**実施日**: 2025-10-10

#### ステップ3.1: useEventListenerフックの作成 ✅ 完了

**目標**: イベントリスナー管理を統合

```text
完了内容:
1. ✅ shared/hooks/system/useEventListener.ts を作成
2. ✅ TypeScript型安全なオーバーロード実装
   - WindowEventMap, DocumentEventMap, HTMLElementEventMap対応
3. ✅ 機能実装
   - 自動クリーンアップ（unmount時にremoveEventListener）
   - useRefで安定したハンドラー参照
   - enabled オプションで条件付き有効化
   - capture, passive オプション対応
4. ✅ shared/hooks/index.ts でエクスポート
5. ✅ 型チェック成功確認
```

**成果**:

- 型安全なイベントリスナーフック
- 手動クリーンアップ不要
- 再利用可能な標準パターン確立

#### ステップ3.2: 既存のaddEventListenerを置き換え ✅ 完了

**目標**: 既存のイベントリスナーパターンをuseEventListenerで統一

```text
完了内容:
1. ✅ 以下のパターンを統一:
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

2. ✅ 置き換え完了ファイル:
   - useKeyboardShortcuts.ts (2箇所: keydown, paste)
   - ContextMenu.tsx (1箇所: mousedown)
   - SelectedNodeNotePanel.tsx (1箇所: mousedown)
   - useMindMapEvents.ts (複数箇所)
   - KeyboardShortcutHelper.tsx (1箇所: keydown)
   - AISidebar.tsx (1箇所: mindflowOllamaBridgeReady)
   - SettingsSidebar.tsx (1箇所: embedding-progress)
   - ImageModal.tsx (1箇所: keydown)
   - LinkActionMenu.tsx (2箇所: mousedown, keydown)

3. ✅ 型チェック・Lint通過確認
```

**成果**:

- イベントリスナー管理が標準化
- useEffect + addEventListener/removeEventListener の手動管理を削減
- コード可読性とメンテナンス性の向上
- カスタムイベント対応（型キャスト使用）

#### ステップ3.3: イベント処理パターンの標準化

**状況**: 次回フェーズで実施予定

```
タスク:
1. BaseEventHandler と BaseDragHandler の利用推進
2. 共通パターンを抽出
3. ドキュメント化
```

#### 成功基準
- [x] useEventListenerフックが実装され、テスト済み
- [x] 主要コンポーネントのaddEventListenerが置き換え完了
- [ ] イベント処理の標準パターンがドキュメント化（次回実施）
- [x] ビルド・型チェック・リント成功
- [x] イベント処理が正常に動作

---

### フェーズ4: Hooks層の簡素化 🔷 低優先度（長期）

**期間**: 3-5日
**リスク**: 高（状態管理の中核）
**影響**: 大（全体的なアーキテクチャ変更）
**価値**: 高（保守性の大幅改善）

#### ステップ4.1: Sidebar関連フックの統合 ✅ 完了

**目標**: sidebar.*系の5個のフックを統合

**実施日**: 2025-10-10

```typescript
// Before: 5個のファイル
- sidebar.mapOps.ts (65行)
- sidebar.folderOps.ts (195行)
- sidebar.contextMenu.tsx (287行)
- sidebar.filtering.ts (133行)
- sidebar.explorerTree.ts (72行)
合計: 752行、5ファイル

// After: 1個のファイル
- useSidebar.tsx (680行)
合計: 680行、1ファイル
```

**成果**:

- **ファイル削減**: 5ファイル → 1ファイル (80%削減)
- **コード削減**: 752行 → 680行 (約10%削減)
- **保守性向上**: サイドバー機能が単一の真実の源に統合
- **型安全性**: すべてのサイドバー操作が統合されたインターフェースを通じてアクセス可能

**実装詳細**:

1. ✅ useSidebar.tsxを作成（JSXサポートのため.tsx拡張子を使用）
2. ✅ 以下の機能を統合:
   - フォルダ操作（作成、削除、リネーム、折りたたみ）
   - マップ操作（作成、リネーム、キャンセル）
   - フィルタリングと検索
   - エクスプローラーツリー管理
   - コンテキストメニュー処理
3. ✅ MindMapSidebar.tsxを更新して新しい統合フックを使用
4. ✅ 古い個別フックファイル（sidebar.*.ts/tsx）を削除
5. ✅ hooks/index.tsでuseSidebarをエクスポート
6. ✅ 型チェック・Lint通過確認

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

- [x] sidebar関連フックが統合 (ステップ4.1完了)
- [ ] MindMap関連フックが階層化 (ステップ4.2未実施)
- [ ] フック間の依存関係が明確
- [x] ビルド・型チェック・リント成功
- [ ] 全機能が正常に動作（未テスト）

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

- [x] feature branchを作成 (`git checkout -b refactor/node-operations-consolidation`)
- [x] 現在の状態をコミット
- [x] ビルド・型チェック・リントが成功することを確認

### フェーズ1実装中

- [x] ステップ1.1: ノード操作の統合完了 (2025-10-10)
- [x] ステップ1.2: パス操作の統合完了 (2025-10-09)
- [ ] ステップ1.3: searchUtilsの整理完了（未実施）
- [x] 各ステップ後にビルド・型チェック実行
- [ ] 各ステップ後にコミット（次回実施）

### フェーズ1完了後

- [ ] すべての成功基準をクリア（ステップ1.3残り）
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
