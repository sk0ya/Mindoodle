# リファクタリング - Quick Wins（即効性のある改善）

このドキュメントは、リファクタリング計画の中でも**即効性が高く、リスクが低い改善**をまとめたものです。

---

## 🎯 Quick Win 1: Adapter Accessor Utility（最優先）

**影響**: 20+箇所の重複削減
**工数**: 2-3時間
**リスク**: 低

### 実装

#### 1. Utility関数の作成
```typescript
// frontend/src/app/core/utils/adapterAccessor.ts

import type { StorageAdapter } from '@/app/core/types';

/**
 * Get storage adapter for a specific workspace
 * Eliminates the repeated pattern of accessing adapters
 */
export function getAdapterForWorkspace(
  persistenceHook: any, // TODO: type this properly in Phase 6
  workspaceId?: string | null
): StorageAdapter | null {
  if (!persistenceHook) return null;

  if (workspaceId && typeof persistenceHook.getAdapterForWorkspace === 'function') {
    return persistenceHook.getAdapterForWorkspace(workspaceId);
  }

  return persistenceHook.storageAdapter || null;
}

/**
 * Get current storage adapter
 */
export function getCurrentAdapter(
  persistenceHook: any
): StorageAdapter | null {
  return persistenceHook?.storageAdapter || null;
}
```

#### 2. 置き換え例

**Before:**
```typescript
const adapter: any = (persistenceHook as any).getAdapterForWorkspace?.(workspaceId) || persistenceHook.storageAdapter;
```

**After:**
```typescript
import { getAdapterForWorkspace } from '@/app/core/utils/adapterAccessor';

const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
```

#### 3. 対象ファイル
- [useMindMap.ts:65](frontend/src/app/features/mindmap/hooks/useMindMap.ts#L65)（20箇所以上）
- [useMindMapClipboard.ts:26](frontend/src/app/features/mindmap/hooks/useMindMapClipboard.ts#L26)
- その他adapter取得箇所

### 期待効果
- **削減**: ~200行
- **可読性**: 大幅向上
- **保守性**: 変更が1箇所で済む

---

## 🎯 Quick Win 2: useStableCallback Hook

**影響**: 115箇所のuseCallback削減
**工数**: 3-4時間
**リスク**: 低

### 実装

#### 1. Utility Hookの作成
```typescript
// frontend/src/app/shared/hooks/utilities/useStableCallback.ts

import { useCallback, useEffect, useRef } from 'react';

/**
 * Creates a stable callback that always uses the latest version
 * Eliminates the need for complex dependency arrays
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: any[]) => {
    return callbackRef.current(...args);
  }) as T, []);
}
```

#### 2. 置き換え例

**Before:**
```typescript
const dataRef = useRef(dataHook.data);
useEffect(() => { dataRef.current = dataHook.data; }, [dataHook.data]);

const someFunction = useCallback(() => {
  // uses dataRef.current instead of dataHook.data
}, [/* complex dependencies */]);
```

**After:**
```typescript
import { useStableCallback } from '@/app/shared/hooks/utilities/useStableCallback';

const someFunction = useStableCallback(() => {
  // can use dataHook.data directly
  // always gets latest value automatically
});
```

#### 3. 段階的置き換え
1. **Phase 1**: 新規コードで使用開始
2. **Phase 2**: 大きなhookから置き換え（useMindMap.ts など）
3. **Phase 3**: 全hookファイルで置き換え

### 期待効果
- **削減**: ~400行（useCallback + useRef パターン）
- **バグ防止**: stale closure問題の解消
- **可読性**: 依存配列管理が不要

---

## 🎯 Quick Win 3: Node Search関数の統合

**影響**: nodeUtils.ts と nodeOperations.ts の重複削減
**工数**: 2-3時間
**リスク**: 低（既存関数をそのまま移動）

### 実装

#### 1. 新しいファイル構成
```
frontend/src/app/features/mindmap/utils/
├── nodeSearch.ts        # ← nodeOperations.ts の内容を移動
├── nodeLayout.ts        # ← nodeUtils.ts から分離
├── nodeText.ts          # ← nodeUtils.ts から分離
└── nodeStyles.ts        # ← nodeUtils.ts から分離
```

#### 2. nodeSearch.ts の統合
```typescript
// frontend/src/app/features/mindmap/utils/nodeSearch.ts

// From nodeOperations.ts
export function findNodeById(/* ... */) { /* ... */ }
export function findNodeInData(/* ... */) { /* ... */ }
export function findParentNode(/* ... */) { /* ... */ }

// From nodeUtils.ts (重複削除)
// export function findNodeById... // ← 削除（nodeOperations版を使用）

export function traverseNodes(/* ... */) { /* ... */ }
export function getSiblingNodes(/* ... */) { /* ... */ }
```

#### 3. Import更新
```typescript
// Before
import { findNodeById } from '@/app/features/mindmap/utils/nodeOperations';
import { traverseNodes } from '@/app/features/mindmap/utils/nodeUtils';

// After
import { findNodeById, traverseNodes } from '@/app/features/mindmap/utils/nodeSearch';
```

### 期待効果
- **削減**: ~300行（重複削除）
- **整理**: 機能別のファイル構成
- **検索性**: ノード関連関数が1箇所に

---

## 🎯 Quick Win 4: Clipboard機能の統合

**影響**: 2つのclipboardファイル統合
**工数**: 1-2時間
**リスク**: 低

### 実装

#### 1. 統合ファイルの作成
```typescript
// frontend/src/app/features/mindmap/utils/clipboard.ts

// From shared/utils/clipboard.ts
export async function readClipboardImageAsFile(): Promise<File | null> {
  // ... existing implementation
}

// From mindmap/utils/clipboardPaste.ts
export function nodeToMarkdown(node: MindMapNode): string {
  // ... existing implementation
}

export async function pasteFromClipboard(/* ... */): Promise<void> {
  // ... existing implementation
}

export function systemClipboardMatchesNode(/* ... */): boolean {
  // ... existing implementation
}
```

#### 2. Import更新
```typescript
// Before
import { readClipboardImageAsFile } from '@/app/shared/utils/clipboard';
import { pasteFromClipboard } from '@/app/features/mindmap/utils/clipboardPaste';

// After
import {
  readClipboardImageAsFile,
  pasteFromClipboard
} from '@/app/features/mindmap/utils/clipboard';
```

### 期待効果
- **削減**: ~50行（統合による整理）
- **整理**: clipboard機能が1箇所に
- **保守性**: 関連機能の一元管理

---

## 🎯 Quick Win 5: Type Definition改善（部分的）

**影響**: "as any" の段階的削減
**工数**: 1-2時間（初期実装）
**リスク**: 低

### 実装

#### 1. PersistenceHook型定義
```typescript
// frontend/src/app/core/types/hooks.types.ts

import type { StorageAdapter, MapIdentifier, MindMapData } from './index';

export interface PersistenceHook {
  // Core state
  storageAdapter: StorageAdapter | null;
  allMindMaps: MindMapData[];
  isInitialized: boolean;

  // Methods
  getAdapterForWorkspace: (workspaceId: string | null) => StorageAdapter | null;
  refreshMapList: () => Promise<void>;
  addMapToList: (map: MindMapData) => Promise<void>;

  // Explorer
  explorerTree?: any; // TODO: define proper type
  loadExplorerTree?: () => Promise<void>;

  // Workspace management
  workspaces?: any[]; // TODO: define proper type
  currentWorkspaceId?: string | null;
  addWorkspace?: () => Promise<void>;
  removeWorkspace?: (id: string) => Promise<void>;
  switchWorkspace?: (id: string) => Promise<void>;
}
```

#### 2. 使用例
```typescript
// Before
const adapter: any = (persistenceHook as any).getAdapterForWorkspace?.(workspaceId);

// After
const adapter = persistenceHook.getAdapterForWorkspace(workspaceId);
```

### 期待効果
- **削減**: ~100行（型キャストの削除）
- **型安全性**: 段階的向上
- **IDE支援**: 補完・エラー検出の改善

---

## 📋 実施順序（推奨）

### Week 1: 基盤整備
1. **Day 1**: Quick Win 1 (Adapter Accessor)
2. **Day 2**: Quick Win 2 (useStableCallback)
3. **Day 3**: Quick Win 5 (Type Definition - 部分的)

**Week 1 削減見込み**: ~700行

### Week 2: Utils整理
4. **Day 1-2**: Quick Win 3 (Node Search統合)
5. **Day 3**: Quick Win 4 (Clipboard統合)

**Week 2 削減見込み**: ~350行

### 合計削減（Quick Winsのみ）
**1,050行** - 目標5,000行の**21%達成**

---

## ✅ 各Quick Winの検証方法

### 1. Adapter Accessor
```bash
# 置き換え箇所の確認
grep -r "getAdapterForWorkspace\?\.\(" frontend/src --include="*.ts" --include="*.tsx"

# 確認
npm run type-check
```

### 2. useStableCallback
```bash
# useCallbackの削減確認
grep -r "useCallback" frontend/src/app/features/mindmap/hooks --include="*.ts" | wc -l

# 動作確認
npm run dev
```

### 3. Node Search統合
```bash
# 重複関数の確認
grep -r "function findNodeById" frontend/src/app/features/mindmap/utils

# 型チェック
npm run type-check
```

### 4. Clipboard統合
```bash
# import更新確認
grep -r "from.*clipboard" frontend/src --include="*.ts" --include="*.tsx"

# 機能テスト（手動）
# - 画像貼り付け
# - テキスト貼り付け
```

### 5. Type Definition
```bash
# "as any" の削減確認
grep -r "as any" frontend/src --include="*.ts" --include="*.tsx" | wc -l

# strict型チェック
npm run type-check:strict
```

---

## 🚀 開始方法

### 1. ブランチ作成
```bash
git checkout -b refactor/quick-wins
```

### 2. Quick Win 1から開始
```bash
# 1. ファイル作成
mkdir -p frontend/src/app/core/utils
touch frontend/src/app/core/utils/adapterAccessor.ts

# 2. 実装
# (上記のコードを実装)

# 3. 置き換え
# (useMindMap.ts などで使用開始)

# 4. 確認
npm run type-check
npm run lint
```

### 3. コミット
```bash
git add .
git commit -m "refactor: add adapter accessor utility (Quick Win 1)

- Create getAdapterForWorkspace utility function
- Replace 20+ duplicate adapter access patterns
- Improve code readability and maintainability
- Reduce code by ~200 lines"
```

---

## 📊 進捗追跡

### Quick Wins進捗表

| ID | 内容 | 削減見込み | 状態 | 完了日 |
|----|------|------------|------|--------|
| QW1 | Adapter Accessor | 200行 | ⬜ 未着手 | - |
| QW2 | useStableCallback | 400行 | ⬜ 未着手 | - |
| QW3 | Node Search統合 | 300行 | ⬜ 未着手 | - |
| QW4 | Clipboard統合 | 50行 | ⬜ 未着手 | - |
| QW5 | Type Definition | 100行 | ⬜ 未着手 | - |
| **合計** | | **1,050行** | | |

### 状態の凡例
- ⬜ 未着手
- 🔄 作業中
- ✅ 完了
- ❌ スキップ

---

**作成日**: 2025-10-10
**対象**: 即効性の高い改善（Quick Wins）
**期待削減**: 1,050行（全体計画の21%）
