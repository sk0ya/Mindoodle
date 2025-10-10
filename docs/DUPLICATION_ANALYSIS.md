# 重複コード分析レポート

このドキュメントは、コードベース内の重複パターンと問題箇所の詳細分析です。

---

## 📊 統計サマリー

### コード規模
- **総行数**: ~25,000行
- **主要ファイル数**: 200+
- **平均ファイルサイズ**: 125行

### 重複指標
- **"as any" 使用**: 251箇所
- **useCallback**: 115箇所
- **useRef**: 14箇所
- **Adapter取得パターン**: 20+箇所

---

## 🔴 Critical Issues（最優先修正）

### 1. Adapter取得パターンの重複（20+箇所）

#### パターン
```typescript
const adapter: any = (persistenceHook as any).getAdapterForWorkspace?.(workspaceId) || persistenceHook.storageAdapter;
```

#### 出現箇所
1. [useMindMap.ts:65](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L65)
2. [useMindMap.ts:314](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L314)
3. [useMindMap.ts:346](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L346)
4. [useMindMap.ts:371](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L371)
5. [useMindMap.ts:388](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L388)
6. [useMindMap.ts:400](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L400)
7. [useMindMap.ts:413](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L413)
8. [useMindMap.ts:458](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L458)
9. [useMindMap.ts:484](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L484)
10. [useMindMap.ts:544](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L544)
11. [useMindMapClipboard.ts:26](frontend/src/app/features/mindmap/hooks/useMindMapClipboard.ts#L26)
12. その他多数...

#### 影響
- **重複行数**: ~200行
- **保守性**: 変更が複数箇所に必要
- **型安全性**: "as any" による型チェック回避

#### 解決策
→ **Quick Win 1**: Adapter Accessor Utilityの作成

---

### 2. useRefパターンの重複（14箇所）

#### パターン: Stale Closure回避
```typescript
const xxxRef = useRef(xxx);
useEffect(() => {
  xxxRef.current = xxx;
}, [xxx]);
```

#### 出現箇所（useMindMap.ts内）
1. `lineToNodeIdRef` + `nodeIdToLineRef` (L79-80)
2. `lastSentMarkdownRef` (L83)
3. `subscribeMdRef` (L86-87)
4. `dataRef` (L90-91)
5. `setDataRef` (L92-93)
6. `updateNodeRef` (L94-95)
7. `applyAutoLayoutRef` (L96-97)
8. `skipNodeToMarkdownSyncTimer` (L100)

#### 影響
- **重複行数**: ~40行（useMindMap.ts のみ）
- **可読性**: パターンの繰り返しが冗長
- **保守性**: 追加・変更時に同じパターンを繰り返す必要

#### 解決策
→ **Quick Win 2**: useStableCallback / useLatestRef Hook

---

### 3. 巨大ファイル問題

#### Top 10 巨大ファイル

| ファイル | 行数 | 問題 | 推奨アクション |
|----------|------|------|----------------|
| nodeUtils.ts | 1,149 | 責務が混在 | 4つに分割 |
| NodeRenderer.tsx | 1,070 | レンダリングロジック肥大化 | 5-6個のコンポーネントに分割 |
| MindMapApp.tsx | 901 | アプリケーションロジック肥大化 | 3-4個のコンポーネントに分割 |
| useMindMap.ts | 787 | orchestrator hook肥大化 | 4個のhookに分割 |
| AISidebar.tsx | 767 | AI機能が1ファイルに | 3-4個のコンポーネントに分割 |
| NodeLinkModal.tsx | 687 | モーダルロジック肥大化 | 2-3個のコンポーネントに分割 |
| useSidebar.tsx | 661 | サイドバー統合hook肥大化 | 4個のhookに分割 |
| NodeEditor.tsx | 636 | エディターロジック肥大化 | 3個のコンポーネントに分割 |
| useKeyboardShortcuts.ts | 603 | ショートカット処理肥大化 | 3個のhookに分割 |
| SettingsSidebar.tsx | 590 | 設定UIが1ファイルに | 複数のセクションに分割 |

#### 合計行数: 7,851行
#### 分割後の削減見込み: ~2,500行

---

## 🟡 High Priority Issues

### 4. Node関連Utils の重複

#### nodeUtils.ts (1,149行) の責務混在

**レイアウト計算（~400行）:**
- `calculateNodeSize`
- `calculateChildNodeX`
- `getNodeBounds`
- `getNodeTopY`, `getNodeBottomY`
- `getNodeLeftX`, `getNodeRightX`
- `getDynamicNodeSpacing`
- `getNodeHorizontalPadding`

**検索・走査（~300行）:**
- `findNodeById`
- `traverseNodes`
- `findParentNode`
- `getSiblingNodes`
- `getFirstVisibleChild`

**テキスト処理（~300行）:**
- `wrapNodeText`
- `smartSplitText`
- `measureTextWidth`
- `calculateTextWidthFallback`

**色・スタイル（~150行）:**
- `getBranchColor`
- `generateBranchColors`
- `getColorSetColors`

#### nodeOperations.ts (291行) との重複
- `findNodeById` - **重複**
- `findNodeInData` - 類似機能
- `findParentNode` - **重複**
- `traverseNodes` - 類似機能

#### 解決策
→ **Phase 3**: Node Utils再編
- nodeLayout.ts（レイアウト計算）
- nodeSearch.ts（検索・走査、nodeOperationsを統合）
- nodeText.ts（テキスト処理）
- nodeStyles.ts（色・スタイル）

---

### 5. Hook層の構成問題

#### useMindMap.ts (787行) の責務分析

**Map Operations（~200行）:**
```typescript
createAndSelectMap
selectMapById
updateMapMetadata
addImportedMapToList
```

**File Operations（~50行）:**
```typescript
exportCurrentMap
importMap
```

**Adapter Operations（~150行）:**
```typescript
selectRootFolder
createFolder
renameItem
deleteItem
moveItem
readImageAsDataURL
getSelectedFolderLabel
```

**Markdown Sync（~200行）:**
```typescript
markdown stream subscription
nodes ↔ markdown synchronization
line number mapping
```

**その他（~187行）:**
- State hooks統合
- useEffect処理
- 通知付きwrapper関数

#### 解決策
→ **Phase 4**: 大規模Hook分割
- useMapOperations.ts
- useFileOperations.ts
- useAdapterOperations.ts
- useMarkdownSync.ts

---

## 🟢 Medium Priority Issues

### 6. Component層の問題

#### NodeRenderer.tsx (1,070行) の責務

**レンダリングロジック（~300行）:**
- SVGレンダリング
- テキスト表示
- アイコン表示

**レイアウト計算（~250行）:**
- 位置計算
- サイズ計算
- 折り返し処理

**インタラクション（~200行）:**
- クリック処理
- ホバー処理
- ドラッグ処理

**スタイル管理（~200行）:**
- 色計算
- 状態別スタイル
- アニメーション

**その他（~120行）:**
- Mermaid統合
- エフェクト処理

#### 解決策
→ **Phase 5**: Component分割
- NodeContent.tsx
- NodeLayout.tsx
- NodeInteraction.tsx
- NodeDecorations.tsx

---

### 7. useCallback過剰使用

#### 統計
- **総使用回数**: 115箇所
- **依存配列の複雑さ**: 平均3-5個の依存
- **保守コスト**: 高（依存配列のメンテナンス）

#### 問題例（useMindMap.ts）
```typescript
const selectRootFolder = useCallback(async (): Promise<boolean> => {
  // 実装
}, [persistenceHook]); // 依存配列の管理が必要

const createFolder = useCallback(async (relativePath: string, workspaceId?: string): Promise<void> => {
  // 実装
}, [persistenceHook]); // 依存配列の管理が必要

// ... 20+ 個の useCallback
```

#### 解決策
→ **Quick Win 2**: useStableCallback Hook
```typescript
const selectRootFolder = useStableCallback(async (): Promise<boolean> => {
  // 実装
  // 依存配列不要！
});
```

---

## 📋 重複パターンのカテゴリ別集計

### A. Hook関連パターン
| パターン | 出現回数 | 削減見込み |
|----------|----------|------------|
| useCallback | 115 | 400行 |
| useRef (stale closure回避) | 14 | 40行 |
| useMemo | 8 | 20行 |
| Adapter取得 | 20+ | 200行 |

### B. Utils関連パターン
| パターン | 出現回数 | 削減見込み |
|----------|----------|------------|
| ノード検索（重複） | 5関数 | 150行 |
| レイアウト計算（分散） | 10+ 関数 | 100行 |
| テキスト処理（分散） | 8関数 | 80行 |

### C. Component関連パターン
| パターン | 出現回数 | 削減見込み |
|----------|----------|------------|
| useState/useEffect | 253 | 500行 |
| 巨大コンポーネント | 10ファイル | 2,500行 |
| 重複UI Logic | - | 300行 |

### D. Type関連パターン
| パターン | 出現回数 | 削減見込み |
|----------|----------|------------|
| "as any" | 251 | 400行 |
| 型定義の欠如 | - | 100行 |

---

## 🎯 削減見込みサマリー

### フェーズ別削減見込み

| Phase | 内容 | 削減見込み | 累積削減 |
|-------|------|------------|----------|
| Quick Wins | 即効改善 | 1,050行 | 1,050行 |
| Phase 1 | Adapter Service | 500行 | 1,550行 |
| Phase 2 | Hook Utilities | 800行 | 2,350行 |
| Phase 3 | Node Utils再編 | 600行 | 2,950行 |
| Phase 4 | Hook分割 | 1,200行 | 4,150行 |
| Phase 5 | Component分割 | 1,500行 | 5,650行 |
| Phase 6 | Type Safety | 400行 | 6,050行 |

### 最終目標
- **削減目標**: 5,000行（20%）
- **削減見込み**: 6,050行（24%）
- **マージン**: +1,050行（安全マージン）

---

## 🔍 詳細分析データ

### ファイルサイズ分布

#### Hooks層
```
useMindMap.ts:              787 ████████████████
useSidebar.tsx:             661 █████████████
useKeyboardShortcuts.ts:    603 ████████████
useMindMapPersistence.ts:   362 ███████
useMindMapViewport.ts:      296 ██████
その他18ファイル:           ~800 ████████████████
```

#### Utils層
```
nodeUtils.ts:               1149 ███████████████████████
その他mindmap utils:        1615 ████████████████████████████████
shared utils:               2575 ██████████████████████████████████████████████████
```

#### Components層
```
NodeRenderer.tsx:           1070 █████████████████████
MindMapApp.tsx:              901 ██████████████████
AISidebar.tsx:               767 ███████████████
その他:                    ~13000 ██████████████████████████████████████████████████████████████████████████████████████████████
```

### "as any" 使用箇所分布

```
mindmap/hooks:              89箇所 ████████████████████
mindmap/components:         67箇所 ██████████████
mindmap/utils:              45箇所 ██████████
core/storage:               28箇所 ██████
その他:                     22箇所 █████
```

---

## 📝 推奨アクション

### 即座に実施すべき（今週中）
1. ✅ Adapter Accessor Utility作成（Quick Win 1）
2. ✅ useStableCallback Hook作成（Quick Win 2）
3. ✅ Type定義の基本整備（Quick Win 5）

### 次週実施
4. ✅ Node Search統合（Quick Win 3）
5. ✅ Clipboard統合（Quick Win 4）
6. ✅ Phase 1開始（Adapter Service層）

### 月内目標
- Quick Wins完了（1,050行削減）
- Phase 1-2完了（1,300行追加削減）
- **合計削減: 2,350行（目標の47%達成）**

---

**作成日**: 2025-10-10
**分析対象**: Mindoodle frontend codebase
**分析ツール**: Serena MCP, grep, wc
