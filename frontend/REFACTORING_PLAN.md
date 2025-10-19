# リファクタリング計画

**作成日**: 2025-10-20
**対象**: Mindoodle Frontend Codebase
**目標**: コードベースの整理とコード量削減 (35-55%削減目標)

---

## 📊 現状分析

### コードベース規模
- **総ファイル数**: 288個のTypeScriptファイル
- **総コード行数**: 42,800行
- **平均**: 149行/ファイル

### モジュール別内訳
| モジュール | 行数 | 割合 |
|----------|------|------|
| mindmap機能 | 29,225行 | 68% |
| commands | 6,172行 | 14% |
| その他 | 7,403行 | 18% |

### 主要な問題点

#### 1. 大規模ファイル (1000行超)
- `TableEditorModal.tsx`: 1,317行
- `NodeRenderer.tsx`: 1,247行
- `MarkdownFolderAdapter.ts`: 1,241行
- `nodeUtils.ts`: 1,082行
- `markdownImporter.ts`: 1,094行
- `nodeSlice.ts`: 1,047行

#### 2. 未使用コード
- ts-pruneで検出された多数の未使用export
- 参照されていない関数・型定義
- 古いコメントアウトコード

#### 3. 高密度結合
- 56ファイルが`useMindMapStore`を直接使用
- 36個の`index.ts`ファイル

#### 4. コード重複
- ノード計算ロジックの重複
- イベントハンドラーパターンの重複
- バリデーションロジックの重複

---

## 🎯 4フェーズリファクタリング計画

### フェーズ1: 未使用コード削除 ✅ 【完了】

**目標**: デッドコードを削除してコードベースをクリーンアップ

**実施結果**:

- ts-pruneで698個の未使用exportを検出
- **判明**: 多くは誤検出 (index.tsによる再エクスポートが原因)
- **結論**: 自動削除は危険、手動での慎重な削除が必要
- **実際の削減**: ほぼなし (誤検出のため安全な削除が困難)

**学んだこと**:

1. ts-pruneは再エクスポートを正しく追跡できない
2. コードベースは既に比較的整理されている
3. **より大きな効果**: ファイル分割・コード統合の方が有効

**方針変更**:

- フェーズ1をスキップし、フェーズ2 (大規模ファイル分割) に注力
- より実用的で効果の高いリファクタリングを優先

**ブランチ**: `refactor/phase1-remove-unused-code` → `refactor/phase2-split-large-files`
**ステータス**: 完了 (方針変更により次フェーズへ)

---

### フェーズ2: 大規模ファイルの分割 ✅ 【一部完了】

**目標**: 1000行超のファイルを責任ごとに分割

#### 2-1. TableEditorModal.tsx (1,317行)
```
現状: 単一ファイル
↓ 分割後
├── components/
│   ├── TableEditorModal.tsx (150行) - メインコンポーネント
│   ├── TableCell.tsx (100行) - セルコンポーネント
│   ├── TableHeader.tsx (80行) - ヘッダー
│   ├── TableContextMenu.tsx (80行) - コンテキストメニュー
│   └── TableSelection.tsx (70行) - 選択範囲表示
├── hooks/
│   ├── useTableEditor.ts (200行) - ビジネスロジック
│   ├── useTableSelection.ts (100行) - 選択ロジック
│   └── useTableKeyboard.ts (80行) - キーボード操作
└── utils/
    ├── tableParser.ts (100行) - Markdown解析
    ├── tableSerializer.ts (80行) - Markdown出力
    └── tableValidation.ts (60行) - バリデーション
```

#### 2-2. NodeRenderer.tsx (1,247行)
```
現状: 単一ファイル
↓ 分割後
├── NodeRenderer.tsx (200行) - メインレンダラー
├── NodeContent.tsx (150行) - テキスト表示
├── NodeImage.tsx (120行) - 画像表示
├── NodeTable.tsx (100行) - テーブル表示
├── NodeMermaid.tsx (80行) - Mermaid図表示
├── NodeSelectionBorder.tsx (60行) - 選択枠
├── hooks/
│   └── useNodeStyles.ts (150行) - スタイル計算
└── utils/
    └── renderUtils.ts (150行) - レンダリングユーティリティ
```

#### 2-3. nodeUtils.ts (1,082行) ✅ 【完了】

**実施結果**:
```
元ファイル: nodeUtils.ts (1,082行)
↓ 分割後 (6ファイル、合計1,148行)
├── nodeMeasurement.ts (436行) ✅ - テキスト測定 & ラッピング
│   - measureTextWidth, wrapNodeText
│   - getNodeTextLineHeight, getNodeTextMaxWidth
│   - 句読点ベースの改行処理
├── nodeSize.ts (338行) ✅ - ノードサイズ計算
│   - calculateNodeSize, calculateIconLayout
│   - getNodeHorizontalPadding, getMarkerPrefixTokens
│   - テーブル寸法計算
├── nodeGeometry.ts (38行) ✅ - 位置 & 境界計算
│   - getNodeLeftX, getNodeRightX
│   - getNodeTopY, getNodeBottomY
│   - getNodeBounds
├── nodeLayout.ts (101行) ✅ - レイアウト計算
│   - getToggleButtonPosition
│   - getDynamicNodeSpacing
│   - calculateChildNodeX
├── nodeColor.ts (178行) ✅ - カラー管理
│   - getBranchColor, generateBranchColors
│   - getColorSetColors (8つのカラーセット)
└── nodeUtils.ts (57行) ✅ - 再エクスポート集約
    - 全モジュールからの再エクスポート
    - 後方互換性を完全に維持
```

**達成した効果**:

- ✅ 保守性: 大幅向上（明確な責任分離）
- ✅ 可読性: 向上（平均182行/ファイル）
- ✅ テスタビリティ: 向上（独立モジュール）
- ✅ 後方互換性: 完全（再エクスポートパターン）

**検証**:

- ✅ Type-check: 成功
- ✅ Build: 成功 (20.69s)
- ✅ Breaking changes: なし

**コミット**: `ce5606e` - refactor(phase2): split nodeUtils.ts into 5 focused modules

#### 2-4. MarkdownFolderAdapter.ts (1,241行)
```
現状: 単一ファイル
↓ 分割後
├── MarkdownFolderAdapter.ts (300行) - メインアダプター
├── FolderOperations.ts (250行) - フォルダ操作
├── FileOperations.ts (200行) - ファイル操作
├── MarkdownSerializer.ts (200行) - Markdown変換
├── FolderScanner.ts (150行) - フォルダスキャン
└── PathResolver.ts (100行) - パス解決
```

#### 2-5. nodeSlice.ts (1,047行)
```
現状: 単一ファイル
↓ 分割後
├── nodeSlice.ts (300行) - メインスライス
├── nodeSelection.ts (200行) - 選択管理
├── nodeEditing.ts (180行) - 編集操作
├── nodeNavigation.ts (150行) - ナビゲーション
├── nodeOperations.ts (150行) - CRUD操作
└── nodeValidation.ts (100行) - バリデーション
```

**予想削減**: 15-20% (6,000-8,500行)
**リスクレベル**: ★★★☆☆ 中
**期間**: 3-5日

**ブランチ**: `refactor/phase2-split-large-files`

---

### フェーズ3: 重複コード統合

**目標**: 共通パターンを抽出してDRY原則を適用

#### 3-1. 共通フックの抽出
```typescript
// 例: ノード選択ロジックの共通化
export const useNodeSelection = () => {
  const selectNode = useMindMapStore(s => s.selectNode);
  const selectedId = useMindMapStore(s => s.selectedNodeId);
  const clearSelection = useMindMapStore(s => s.clearSelection);
  return { selectNode, selectedId, clearSelection };
};

// 例: ノード編集状態の共通化
export const useNodeEditing = () => {
  const editingNodeId = useMindMapStore(s => s.editingNodeId);
  const startEditing = useMindMapStore(s => s.startEditing);
  const stopEditing = useMindMapStore(s => s.stopEditing);
  return { editingNodeId, startEditing, stopEditing, isEditing: !!editingNodeId };
};
```

#### 3-2. サービス層の強化
```typescript
// NodeOperationService.ts
export class NodeOperationService {
  static calculateNodePosition(node: Node, parent: Node): Position {
    // 共通ロジック
  }

  static validateNodeStructure(node: Node): ValidationResult {
    // 共通ロジック
  }

  static computeNodePath(node: Node, rootNodes: Node[]): string[] {
    // 共通ロジック
  }
}

// NodeValidationService.ts
export class NodeValidationService {
  static validateNodeData(node: Node): ValidationResult
  static validateNodeTree(nodes: Node[]): ValidationResult
  static sanitizeNodeText(text: string): string
}
```

#### 3-3. 共通型定義の統合
```typescript
// 散在している型定義を統一
// Before: 各ファイルで独自定義
// After: shared/types/node.types.ts に統合
export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface NodeBounds extends NodePosition, NodeSize {}
```

#### 3-4. イベントハンドラーの統合
```typescript
// 重複しているイベントハンドラーパターンを共通化
export const useNodeEventHandlers = (nodeId: string) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 共通ロジック
  }, [nodeId]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 共通ロジック
  }, [nodeId]);

  return { handleClick, handleDoubleClick };
};
```

**予想削減**: 10-15% (4,000-6,000行)
**リスクレベル**: ★★★☆☆ 中
**期間**: 2-4日

**ブランチ**: `refactor/phase3-consolidate-duplication`

---

### フェーズ4: アーキテクチャ最適化

**目標**: 依存関係を整理して保守性向上

#### 4-1. Store依存の整理
```typescript
// Before: 56ファイルで直接useMindMapStoreを使用
const data = useMindMapStore(s => s.rootNodes);
const selectNode = useMindMapStore(s => s.selectNode);

// After: セレクター層の導入
// mindmap/selectors/index.ts
export const useRootNodes = () => useMindMapStore(s => s.rootNodes);
export const useNodeSelection = () => useMindMapStore(s => ({
  selectedId: s.selectedNodeId,
  selectNode: s.selectNode,
  clearSelection: s.clearSelection
}));

// コンポーネント内
const rootNodes = useRootNodes();
const { selectedId, selectNode } = useNodeSelection();
```

#### 4-2. index.ts の統廃合
現状36個のindex.tsを見直し:
- 本当に必要なものだけ残す
- 過度な再エクスポートを削減
- 直接インポートできるものは直接インポート

```typescript
// Before: 多層の再エクスポート
// features/index.ts → mindmap/index.ts → components/index.ts → Node/index.ts

// After: 必要な箇所のみindex.ts
// features/mindmap/index.ts (主要エクスポートのみ)
export { MindMapApp } from './components/layout/MindMapApp';
export { useMindMap } from './hooks/useMindMap';
export { useMindMapStore } from './store/mindMapStore';
```

#### 4-3. 循環依存の解消
依存関係グラフを整理:
- 循環参照の検出と解消
- 依存方向の統一 (features → shared → core)
- インターフェース分離の原則を適用

**予想削減**: 5-10% (2,000-4,000行)
**リスクレベル**: ★★★★☆ 高
**期間**: 3-5日

**ブランチ**: `refactor/phase4-optimize-architecture`

---

## 📈 期待効果まとめ

| フェーズ | 削減率 | 累計削減行数 | リスク | 期間目安 | ブランチ |
|---------|-------|-------------|--------|----------|---------|
| フェーズ1 | 5-10% | 2-4K行 | 低 | 1-2日 | refactor/phase1-remove-unused-code |
| フェーズ2 | 15-20% | 8-12K行 | 中 | 3-5日 | refactor/phase2-split-large-files |
| フェーズ3 | 10-15% | 12-18K行 | 中 | 2-4日 | refactor/phase3-consolidate-duplication |
| フェーズ4 | 5-10% | 15-23K行 | 高 | 3-5日 | refactor/phase4-optimize-architecture |

**総削減目標**: 35-55% (約15,000-23,000行削減)
**総期間**: 9-16日

---

## 🚀 実施手順

### 各フェーズ共通の手順

#### 1. 準備
```bash
# 現在のブランチを確認
git status
git branch

# リファクタリング用ブランチ作成
git checkout -b refactor/phase{N}-{description}
```

#### 2. 実施
各フェーズの実施内容に従って作業

#### 3. 検証
```bash
# 型チェック
npm run type-check:strict

# Lint
npm run lint

# ビルド
npm run build

# テスト (もしあれば)
npm run test
```

#### 4. コミット
```bash
git add .
git commit -m "refactor(phase{N}): {description}"
```

#### 5. PR作成
- 各フェーズを独立したPRにする
- レビューしやすく、問題があればロールバック可能
- マージ後に次のフェーズへ

---

## ⚠️ 注意事項

### リスク管理
1. **各フェーズ後に必ずビルド・型チェック**
2. **段階的にコミット** (一度に大量の変更をしない)
3. **機能が壊れていないことを確認**
4. **問題があれば即座にロールバック**

### ベストプラクティス
1. **小さく始める** - フェーズ1から順番に
2. **テストを書く** - リファクタリング時に追加
3. **ドキュメント更新** - 構造変更時は必ず
4. **チーム共有** - 変更内容を周知

### 成功基準
- ✅ すべてのビルドが成功
- ✅ すべての型チェックが通過
- ✅ 既存機能が正常に動作
- ✅ コード行数が削減されている
- ✅ コードの可読性・保守性が向上

---

## 📝 進捗管理

### フェーズ1: 未使用コード削除
- [ ] ts-pruneで未使用export特定
- [ ] normalizedStore関連の未使用コード削除
- [ ] embedding関連の未使用コード削除
- [ ] markdown関連の未使用コード削除
- [ ] その他の未使用export削除
- [ ] 検証 (type-check, lint, build)
- [ ] コミット & PR作成

### フェーズ2: 大規模ファイルの分割
- [ ] TableEditorModal.tsx 分割
- [ ] NodeRenderer.tsx 分割
- [ ] nodeUtils.ts 分割
- [ ] MarkdownFolderAdapter.ts 分割
- [ ] nodeSlice.ts 分割
- [ ] 検証 (type-check, lint, build)
- [ ] コミット & PR作成

### フェーズ3: 重複コード統合
- [ ] 共通フックの抽出
- [ ] サービス層の強化
- [ ] 共通型定義の統合
- [ ] イベントハンドラーの統合
- [ ] 検証 (type-check, lint, build)
- [ ] コミット & PR作成

### フェーズ4: アーキテクチャ最適化
- [ ] Store依存の整理
- [ ] index.ts の統廃合
- [ ] 循環依存の解消
- [ ] 検証 (type-check, lint, build)
- [ ] コミット & PR作成

---

## 🎯 完了後の状態

### 目標とするコードベース
- **総行数**: 27,000-20,000行 (現在: 42,800行)
- **平均ファイルサイズ**: 100-120行
- **最大ファイルサイズ**: 500行以下
- **未使用コード**: 0%
- **コード重複**: 最小限

### 品質指標
- **保守性**: 高 (小さく明確な責任)
- **可読性**: 高 (適切な命名と分割)
- **テスタビリティ**: 高 (独立したモジュール)
- **拡張性**: 高 (明確な境界)

---

**作成者**: Claude Code
**最終更新**: 2025-10-20
