# Phase 4: Store依存の整理 - 分析結果

## 現状分析

### 統計
- **useMindMapStore使用ファイル数**: 46ファイル
- **Phase 3共通フック使用ファイル数**: 4ファイルのみ
  - useStoreSelectors.ts (定義ファイル)
  - useNodeSelection.ts (定義ファイル)
  - useNodeEditing.ts (定義ファイル)
  - useMindMap.ts (統合フック)

### 主要な使用パターン

#### パターン1: 全体ストアアクセス (17ファイル)
```typescript
const store = useMindMapStore();
// 多数のプロパティとメソッドにアクセス
```
**該当ファイル**:
- useMindMapActions.ts
- useMindMapData.ts
- MindMapApp.tsx
- NodeRenderer.tsx
- など

**置き換え方針**: これらは複雑な操作を行うため、useStoreSelectorsの個別フックを組み合わせる

#### パターン2: getState()による同期アクセス (15ファイル)
```typescript
const store = useMindMapStore.getState();
const { selectedNodeId, selectNode } = useMindMapStore.getState();
```
**該当ファイル**:
- useKeyboardShortcuts.ts (イベントハンドラ内)
- CanvasEvent.normal.ts
- CanvasEvent.insert.ts
- CanvasEvent.visual.ts
- dispatcher.ts
- など

**置き換え方針**: イベントハンドラやコールバック内では getState() を維持（React外での使用のため）

#### パターン3: 特定プロパティのみアクセス (14ファイル)
```typescript
const { settings, updateSetting } = useMindMapStore();
const selectedNodeId = useMindMapStore(s => s.selectedNodeId);
```
**該当ファイル**:
- SettingsSidebar.tsx
- VimSettingsPanel.tsx
- ColorSettingsSidebar.tsx
- SearchSidebar.tsx
- など

**置き換え方針**: useStoreSelectorsの個別フックに直接置き換え可能

## Phase 3共通フックの機能範囲

### useStoreSelectors.ts
```typescript
// Data selectors
useRootNodes() → rootNodes
useMapTitle() → title
useMapData() → data
useNormalizedData() → normalizedData

// UI selectors
useUIMode() → mode
useUI() → ui
useViewport() → { zoom, pan, setZoom, setPan }

// History selectors
useHistoryState() → { canUndo, canRedo, undo, redo }

// Settings selectors
useSettings() → settings
useUpdateSetting() → updateSetting

// Panel controls
usePanelControls() → { setMarkdownPanelWidth, setNodeNotePanelHeight }

// Cache controls
useCacheControls() → { clearMermaidRelatedCaches }
```

### useNodeSelection.ts
```typescript
selectedNodeId
selectNode(id)
clearSelection()
isSelected(id)
hasSelection
```

### useNodeEditing.ts
```typescript
editingNodeId
startEditing(id)
startEditingWithCursorAtEnd(id)
startEditingWithCursorAtStart(id)
cancelEditing()
finishEditing(id, text)
editText
setEditText(text)
isEditing(id?)
```

## 置き換え優先度と戦略

### 優先度1: シンプルな置き換え (14ファイル)
特定プロパティのみアクセス → 個別フックに直接置き換え

**ターゲットファイル**:
1. ColorSettingsSidebar.tsx → useSettings, useUpdateSetting
2. SettingsSidebar.tsx → useSettings, useUpdateSetting
3. VimSettingsPanel.tsx → useSettings, useUpdateSetting
4. SearchSidebar.tsx → useRootNodes, useNodeSelection
5. MindMapSidebar.tsx → useUI
6. KeyboardShortcutHelper.tsx → useSettings
7. NodeNotesPanel.tsx → useRootNodes
8. SelectedNodeNotePanel.tsx → useNodeSelection
9. MermaidRenderer.tsx → useCacheControls
10. VimMappingsEditor.tsx → useSettings, useUpdateSetting

### 優先度2: 複数フック組み合わせ (17ファイル)
全体ストアアクセス → 複数の個別フックを組み合わせ

**ターゲットファイル**:
1. useMindMapActions.ts
2. useMindMapData.ts
3. useMindMapUI.ts
4. useMindMapViewport.ts
5. Node.tsx
6. NodeEditor.tsx
7. NodeRenderer.tsx
8. CanvasRenderer.tsx
9. MindMapApp.tsx

### 優先度3: getState()の見直し (15ファイル)
同期アクセスパターン → 可能な場所はフック化、不可能な場所は維持

**ターゲットファイル**:
1. useKeyboardShortcuts.ts (一部のみ置き換え)
2. CanvasEvent.normal.ts (維持)
3. CanvasEvent.insert.ts (維持)
4. CanvasEvent.visual.ts (維持)
5. dispatcher.ts (維持)

## 実装計画

### Step 1: useStoreSelectorsの拡張
不足している機能を追加:
```typescript
// Node operations
export const useNodeOperations = () => {
  return useMindMapStore(s => ({
    addChildNode: s.addChildNode,
    updateNode: s.updateNode,
    deleteNode: s.deleteNode,
    moveNode: s.moveNode,
    moveNodeWithPosition: s.moveNodeWithPosition,
    changeSiblingOrder: s.changeSiblingOrder,
    toggleNodeCollapse: s.toggleNodeCollapse,
  }));
};

// Map operations
export const useMapOperations = () => {
  return useMindMapStore(s => ({
    setData: s.setData,
    setRootNodes: s.setRootNodes,
    updateMapMetadata: s.updateMapMetadata,
    applyAutoLayout: s.applyAutoLayout,
  }));
};

// UI operations
export const useUIOperations = () => {
  return useMindMapStore(s => ({
    setMode: s.setMode,
    setActiveView: s.setActiveView,
    togglePanel: s.togglePanel,
    toggleSidebar: s.toggleSidebar,
  }));
};
```

### Step 2: 優先度1 - シンプルな置き換え
個別に小さなコミットで実行

**例: ColorSettingsSidebar.tsx**
```typescript
// Before
const { settings, updateSetting } = useMindMapStore();

// After
import { useSettings, useUpdateSetting } from '../hooks/useStoreSelectors';
const settings = useSettings();
const updateSetting = useUpdateSetting();
```

### Step 3: 優先度2 - 複数フック組み合わせ
各ファイルごとに段階的に実行

**例: useMindMapData.ts**
```typescript
// Before
const store = useMindMapStore();
return {
  data: store.data,
  selectedNodeId: store.selectedNodeId,
  ...
};

// After
import { useMapData, useNodeSelection, useNodeEditing, useNodeOperations } from './useStoreSelectors';
const data = useMapData();
const { selectedNodeId } = useNodeSelection();
const { editingNodeId, editText, editingMode } = useNodeEditing();
const nodeOps = useNodeOperations();
return {
  data,
  selectedNodeId,
  ...nodeOps
};
```

### Step 4: 検証
各置き換え後に実行:
```bash
npm run type-check
npm run build
npm run lint
```

## 期待される効果

### コード品質
- **一貫性**: ストアアクセスパターンの統一
- **可読性**: 必要な状態が明確になる
- **保守性**: 変更の影響範囲が限定される

### パフォーマンス
- **再レンダリング最適化**: 必要な状態のみサブスクライブ
- **メモ化効率**: 個別フックでのメモ化が効果的に機能

### 開発体験
- **型安全性**: 個別フックでの型推論が向上
- **IDE補完**: より適切な補完候補の提示
- **デバッグ**: 状態変更の追跡が容易

## リスクと対策

### リスク1: 大規模な変更
**対策**: 小さなコミットで段階的に実施、各段階で検証

### リスク2: パフォーマンス影響
**対策**: 変更前後でReact DevToolsでレンダリング回数を比較

### リスク3: 未発見のバグ
**対策**: 手動テストを各機能で実施、特にエッジケースに注目

## 次のステップ
1. useStoreSelectorsに不足機能を追加
2. 優先度1のファイルから置き換え開始
3. 各ファイル変更後にtype-check + build
4. すべての置き換え完了後、統合テスト
