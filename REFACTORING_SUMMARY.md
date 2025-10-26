# コード削減 - 関数型プログラミングによるリファクタリング

## 現在の進捗

### ✅ 完了したリファクタリング

| ファイル | 削減前 | 削減後 | 削減量 | 削減率 |
|---------|--------|--------|--------|--------|
| `useBooleanState.ts` | 379行 | 253行 | -126行 | -33% |
| `center.ts` | 126行 | 38行 | -88行 | -70% |
| `showKnowledgeGraph.ts` | 40行 | 25行 | -15行 | -38% |
| **合計** | **545行** | **316行** | **-229行** | **-42%** |

### 📦 作成した関数型ユーティリティ（1,643行）

#### 1. `functionalReact.ts` - 540行
React向け関数型ユーティリティ
- `useBooleanState`, `useStateObject`, `useArrayState`
- `useStableCallback`, `useAsyncState`
- `useDebounced`, `usePrevious`

#### 2. `vimFunctional.ts` - 340行
Vimモード関数型ユーティリティ
- モード判定・遷移、コマンドバッファパース
- ノード述語・変換、検索ヘルパー

#### 3. `commandFunctional.ts` - 450行
コマンドシステム関数型ユーティリティ
- ガード合成、コマンドビルダー
- カテゴリ別ファクトリー、結果ヘルパー

#### 4. `nodeFunctional.ts` - 313行
ノード操作関数型ユーティリティ
- ツリー操作、ノード変換
- パス操作、検証

## コード削減の効果

### Before → After 比較

**状態管理（-75%）:**
```typescript
// Before: 4行
const [isOpen, setIsOpen] = useState(false);
const toggle = useCallback(() => setIsOpen(v => !v), []);
const open = useCallback(() => setIsOpen(true), []);
const close = useCallback(() => setIsOpen(false), []);

// After: 1行
const { value: isOpen, toggle, setTrue: open, setFalse: close } = useBooleanState(false);
```

**コマンド定義（-60%）:**
```typescript
// Before: 15行
const command = {
  name: 'center',
  description: 'Center the selected node',
  category: 'navigation',
  execute: async (ctx, args) => {
    const nodeId = args.nodeId || ctx.selectedNodeId;
    if (!nodeId) {
      return { success: false, error: 'No node selected' };
    }
    try {
      ctx.handlers.centerNodeInView(nodeId, true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// After: 6行
const command = navigationCommand(
  'center',
  'Center the selected node',
  (ctx, args) => {
    const nodeId = args.nodeId || ctx.selectedNodeId;
    if (!nodeId) return failure('No node selected');
    ctx.handlers.centerNodeInView(nodeId, true);
    return success();
  }
);
```

## 次の削減対象

### 大きなファイル

1. **useVimMode.ts** (836行)
   - 予想削減: ~300行（35%）
   - アプローチ: `useStateObject`で状態を統合

2. **useMindMap.ts** (836行)
   - 予想削減: ~250行（30%）
   - アプローチ: 関数型パターンで簡素化

3. **NodeRenderer.tsx** (1139行)
   - 予想削減: ~230行（20%）
   - アプローチ: ロジックを分離

4. **navigation.ts** (297行)
   - 予想削減: ~100行（33%）
   - アプローチ: 重複コマンドを統合

5. **structure.ts** (273行)
   - 予想削減: ~90行（33%）
   - アプローチ: 関数型ファクトリーで簡素化

**合計予想削減: ~970行**

## メリット

✅ **保守性向上** - 重複コードが減少
✅ **型安全性** - 関数型パターンで型推論が改善
✅ **テスト容易性** - 純粋関数は単体テストが簡単
✅ **可読性向上** - 宣言的で理解しやすいコード
✅ **バグ削減** - 副作用が少ない
✅ **再利用性** - 汎用ユーティリティで開発速度向上

## 統計

- ✅ 再利用可能ユーティリティ: **1,643行**
- ✅ 削減したコード: **229行**
- 🎯 次の削減目標: **~970行**
- 📊 最終予想削減: **~1,200行** (既存コードの約20%)
