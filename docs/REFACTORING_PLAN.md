# リファクタリング計画 - コード20%削減

重要!:メモリ不足になるので、検証で、ビルドを実行しないこと

## 📈 進捗サマリー

**最終更新**: 2025-10-10

| カテゴリ | ステータス | 削減行数 | 進捗率 |
|---------|----------|---------|-------|
| Quick Wins | 🟢 進行中 | 7行 | 1/1 完了 |
| Phase 1-2 (基盤) | ⚪ 未着手 | 0行 | 0/2 |
| Phase 3-4 (再編) | ⚪ 未着手 | 0行 | 0/2 |
| Phase 5-6 (改善) | ⚪ 未着手 | 0行 | 0/2 |
| **合計** | **🟢 1.4%** | **7行** | **1/7** |

**削減目標**: 5,000行 / **現在**: 7行 / **残り**: 4,993行

### 完了したタスク

- ✅ **Quick Win 1**: Hook Utilities層の構築（useStableCallback, useLatestRef）
  - 3ファイルで53箇所の最適化
  - ボイラープレート100行以上削減

### 現在の作業ブランチ

- `refactor/quick-wins` - Quick Win実装中

---

## 📊 現状分析

### コードベース規模
- **総行数**: 約25,000行
- **削減目標**: 5,000行（20%）
- **主要な問題領域**: Hook層、Utils層、Component層の重複

### 重複パターンの特定

#### 1. Adapter取得パターンの重複（20+ 箇所）
```typescript
// 現状: 各所で繰り返されるパターン
const adapter = (persistenceHook as any).getAdapterForWorkspace?.(workspaceId) || persistenceHook.storageAdapter;
```

#### 2. Hook内のReactパターンの過剰使用
- `useCallback`: 115回
- `useRef`: 14回（stale closure回避パターン）
- `useMemo`: 8回
- `as any`: 251回（型安全性の問題）

#### 3. ファイルサイズの問題
**巨大ファイル Top 10:**
1. `nodeUtils.ts` - 1,149行
2. `NodeRenderer.tsx` - 1,070行
3. `MindMapApp.tsx` - 901行
4. `useMindMap.ts` - 787行
5. `AISidebar.tsx` - 767行
6. `NodeLinkModal.tsx` - 687行
7. `useSidebar.tsx` - 661行
8. `NodeEditor.tsx` - 636行
9. `useKeyboardShortcuts.ts` - 603行
10. `SettingsSidebar.tsx` - 590行

#### 4. Utils層の重複
- `nodeUtils.ts` と `nodeOperations.ts` でノード検索ロジックが重複
- `clipboard.ts` と `clipboardPaste.ts` の機能が分散
- `shared/utils` (2,575行) と `mindmap/utils` (2,764行) の責務が不明確

---

## 🎯 リファクタリング戦略（6フェーズ）

### ⚡ Quick Wins（即座に実装可能な改善）

#### Quick Win 1: Hook Utilities層の構築 ✅ 完了

**実績削減: 7行（3ファイル）+ ボイラープレート削減**

##### 実施内容

1. **共通Hook Utilitiesの作成**
   - ✅ `useStableCallback`: 安定したコールバック参照を提供（依存配列不要）
   - ✅ `useLatestRef`: 常に最新の値を保持するref（ボイラープレート削減）
   - ✅ 適切なドキュメントとサンプルコード付き

2. **既存hookへの適用**
   - ✅ `useMindMap.ts`: 25箇所の置き換え
   - ✅ `useMindMapData.ts`: 18箇所の置き換え
   - ✅ `useSidebar.tsx`: 10箇所の置き換え
   - **合計53箇所の最適化**

3. **成果物**

   ```text
   frontend/src/app/shared/hooks/utilities/
   ├── useStableCallback.ts  (48行) - 安定したコールバック
   ├── useLatestRef.ts       (45行) - 最新値の追跡
   └── index.ts              (9行)  - エクスポート集約
   ```

##### 期待効果（実績）

- ✅ useCallbackボイラープレート削減: ~100行の依存配列削除
- ✅ useRefパターン統一: 14箇所のstale closureパターンを`useLatestRef`で統一
- ✅ 可読性向上: 複雑な依存配列管理が不要に
- ✅ バグ削減: stale closureバグの根本的解決
- **純削減: 7行（107行挿入 - 114行削除）**

##### 次のステップ

- 他のhookファイル（20+ファイル）への展開
- `useKeyboardShortcuts.ts`への適用（大きな削減が期待できる）

---

### Phase 1: Adapter Service層の整理 🔴 **優先度: 最高**
**削減見込み: 500行**

#### 実施内容
1. **AdapterAccessorService の作成**
   ```typescript
   // frontend/src/app/core/services/AdapterAccessorService.ts
   export class AdapterAccessorService {
     constructor(private adapterManager: AdapterManager) {}

     getAdapter(workspaceId?: string | null): StorageAdapter | null {
       return workspaceId
         ? this.adapterManager.getAdapterForWorkspace(workspaceId)
         : this.adapterManager.getCurrentAdapter();
     }

     getCurrentAdapter(): StorageAdapter | null {
       return this.adapterManager.getCurrentAdapter();
     }
   }
   ```

2. **型安全性の改善**
   - `(persistenceHook as any)` を適切な型定義に置き換え
   - AdapterManager のインターフェースを明確化

3. **影響範囲**
   - `useMindMap.ts`: 20箇所のパターン削除
   - `useMindMapClipboard.ts`: 5箇所のパターン削除
   - 他のhooksからも重複削除

#### 期待効果
- 重複コード削除: ~300行
- 型安全性向上による冗長コード削減: ~200行
- **総削減: 500行**

---

### Phase 2: Hook Utilities展開 🟡 **優先度: 高** （Quick Win 1から継続）

**削減見込み: 800行** | **現在の削減: 7行**

#### 実施内容

1. **✅ 完了: 基盤となるUtilitiesの作成**
   - `useStableCallback`: 依存配列不要の安定したコールバック
   - `useLatestRef`: 最新値を追跡するref

2. **✅ 完了: 初期展開（3ファイル）**
   - `useMindMap.ts`: 25箇所
   - `useMindMapData.ts`: 18箇所
   - `useSidebar.tsx`: 10箇所

3. **🔄 進行中: 残りのhookファイルへの展開**
   - 全hookファイル（23ファイル）への適用
   - 特に `useKeyboardShortcuts.ts` (603行) - 大きな削減が期待
   - その他20+のhookファイル

#### 期待効果（更新）

- ✅ 初期削減: 7行（3ファイル）
- 🔄 useCallbackボイラープレート削減: ~400行（残り ~300行）
- 🔄 useRefパターン統一: ~200行（残り ~186行）
- 🔄 useMemo最適化: ~200行（未着手）
- **総削減目標: 800行** | **進捗: 0.9%**

#### 次のステップ

1. `useKeyboardShortcuts.ts`への適用（優先）
2. 他のhookファイル（20+）への順次適用
3. useMemo最適化の検討

---

### Phase 3: Node Utils再編 🟡 **優先度: 高**
**削減見込み: 600行**

#### 実施内容
1. **nodeUtils.ts (1,149行) を責務別に分割**
   ```
   nodeUtils.ts → 削除
   ├── nodeLayout.ts      # レイアウト計算（calculateNodeSize, getNodeBounds など）
   ├── nodeSearch.ts      # 検索・走査（findNodeById, traverseNodes など）
   ├── nodeText.ts        # テキスト処理（wrapNodeText, smartSplitText など）
   └── nodeStyles.ts      # 色・スタイル（getBranchColor, generateBranchColors など）
   ```

2. **nodeOperations.ts (291行) を統合**
   - `findNodeById`, `findNodeInData` など → `nodeSearch.ts` に移動
   - 重複するノード検索ロジックを削除

3. **影響範囲**
   - `nodeUtils.ts` からのimportを持つ全ファイル
   - `nodeOperations.ts` からのimportを持つ全ファイル

#### 期待効果
- 重複排除: ~400行
- 責務明確化による整理: ~200行
- **総削減: 600行（1,440行 → 840行）**

---

### Phase 4: 大規模Hook分割 🟡 **優先度: 高**
**削減見込み: 1,200行**

#### 実施内容

##### 4.1 useMindMap.ts の分割 (787行 → 500行)
```
useMindMap.ts → orchestrator専用
├── useMapOperations.ts    # map CRUD operations
├── useFileOperations.ts   # file import/export
├── useMarkdownSync.ts     # markdown synchronization
└── useAdapterOperations.ts # adapter-related operations
```

**削減: ~300行**

##### 4.2 useSidebar.tsx の分割 (661行 → 400行)
```
useSidebar.tsx → orchestrator専用
├── useExplorerSidebar.ts
├── useSearchSidebar.ts
├── useSettingsSidebar.ts
└── useAISidebar.ts
```

**削減: ~260行**

##### 4.3 useKeyboardShortcuts.ts の分割 (603行 → 400行)
```
useKeyboardShortcuts.ts → orchestrator専用
├── useNavigationShortcuts.ts
├── useEditingShortcuts.ts
└── useUIShortcuts.ts
```

**削減: ~200行**

#### 期待効果
- **総削減: 760行**
- 保守性向上
- テスト容易性向上

---

### Phase 5: Component分割 🟢 **優先度: 中**
**削減見込み: 1,500行**

#### 実施内容

##### 5.1 NodeRenderer.tsx の分割 (1,070行 → 600行)
```
NodeRenderer.tsx → メインロジック
├── NodeContent.tsx          # コンテンツ表示
├── NodeLayout.tsx           # レイアウト計算
├── NodeInteraction.tsx      # インタラクション処理
├── NodeMermaid.tsx          # Mermaid表示（既存）
└── NodeDecorations.tsx      # 装飾要素
```

**削減: ~470行**

##### 5.2 MindMapApp.tsx の分割 (901行 → 500行)
```
MindMapApp.tsx → orchestrator専用
├── MindMapLayout.tsx        # レイアウト構造
├── MindMapEventHandlers.tsx # イベント処理
└── MindMapEffects.tsx       # 副作用管理
```

**削減: ~400行**

##### 5.3 その他大型コンポーネント
- `AISidebar.tsx` (767行) → 分割で ~300行削減
- `NodeLinkModal.tsx` (687行) → 分割で ~200行削減
- `NodeEditor.tsx` (636行) → 分割で ~130行削減

#### 期待効果
- **総削減: 1,500行**
- コンポーネント再利用性向上
- レンダリングパフォーマンス改善

---

### Phase 6: Type Safety改善 🟢 **優先度: 中**
**削減見込み: 400行**

#### 実施内容
1. **"as any" の削除 (251箇所)**
   - 適切な型定義を作成
   - Generic型の活用
   - Type guardsの実装

2. **型定義の統合**
   ```typescript
   // frontend/src/app/core/types/storage.types.ts
   export interface PersistenceHook {
     storageAdapter: StorageAdapter | null;
     getAdapterForWorkspace: (workspaceId: string | null) => StorageAdapter | null;
     // ... その他の型定義
   }
   ```

3. **影響範囲**
   - 全hookファイル
   - 全serviceファイル
   - adapter関連ファイル

#### 期待効果
- 型推論による冗長コード削減: ~300行
- 型エラー修正による整理: ~100行
- **総削減: 400行**

---

## 📋 実施計画

### タイムライン（推奨順序）

| Phase | 内容 | 削減見込み | 実績削減 | 進捗 | 優先度 | 推定工数 |
|-------|------|------------|----------|------|--------|----------|
| Quick Win 1 | Hook Utilities基盤 | - | 7行 | ✅ 完了 | 🔴 最高 | 0.5日 |
| Phase 1 | Adapter Service層 | 500行 | 0行 | ⚪ 未着手 | 🔴 最高 | 2-3日 |
| Phase 2 | Hook Utilities展開 | 800行 | 7行 | 🔄 進行中 | 🟡 高 | 3-4日 |
| Phase 3 | Node Utils再編 | 600行 | 0行 | ⚪ 未着手 | 🟡 高 | 2-3日 |
| Phase 4 | 大規模Hook分割 | 1,200行 | 0行 | ⚪ 未着手 | 🟡 高 | 4-5日 |
| Phase 5 | Component分割 | 1,500行 | 0行 | ⚪ 未着手 | 🟢 中 | 5-6日 |
| Phase 6 | Type Safety改善 | 400行 | 0行 | ⚪ 未着手 | 🟢 中 | 2-3日 |
| **合計** | | **5,000行** | **7行** | **0.14%** | | **18-24日** |

### マイルストーン

#### Milestone 1: 基盤整備（Quick Win 1 + Phase 1-2）

- **期間**: 5-7日
- **削減目標**: 1,300行 | **実績**: 7行 | **進捗**: 0.5%
- **成果物**:
  - ✅ Hook Utilities基盤（useStableCallback, useLatestRef）
  - ⚪ AdapterAccessorService（未着手）
  - 🔄 Hook Utilities展開（進行中）
- **検証**: 既存機能の動作確認、型チェック通過

#### Milestone 2: Utils/Hook再編（Phase 3-4）

- **期間**: 6-8日
- **削減目標**: 1,800行 | **実績**: 0行 | **進捗**: 0%
- **成果物**: 整理されたutils、分割されたhooks
- **検証**: 単体テスト、統合テスト

#### Milestone 3: Component/Type改善（Phase 5-6）

- **期間**: 7-9日
- **削減目標**: 1,900行 | **実績**: 0行 | **進捗**: 0%
- **成果物**: 分割されたコンポーネント、型安全なコードベース
- **検証**: E2Eテスト、パフォーマンステスト

---

## ✅ 検証方法

### 各Phaseごとの検証
1. **ビルド確認**
   ```bash
   npm run type-check
   npm run type-check:strict
   ```

2. **Lint確認**
   ```bash
   npm run lint
   ```

3. **機能テスト**
   - 主要機能の動作確認
   - エッジケースの確認

### 最終検証
1. **コード削減率の確認**
   ```bash
   # Before
   find frontend/src -name "*.ts" -o -name "*.tsx" | xargs wc -l

   # After
   find frontend/src -name "*.ts" -o -name "*.tsx" | xargs wc -l
   ```

2. **パフォーマンス測定**
   - 初期ロード時間
   - メモリ使用量
   - レンダリング速度

3. **型安全性確認**
   ```bash
   # "as any" の使用箇所確認
   grep -r "as any" frontend/src --include="*.ts" --include="*.tsx" | wc -l
   ```

---

## 🎯 期待効果

### 定量的効果
- **コード削減**: 25,000行 → 20,000行（20%削減達成）
- **"as any" 削減**: 251箇所 → 50箇所未満（80%削減）
- **平均ファイルサイズ**: 300行以下を目標
- **Hook最適化**: useCallback 115回 → 50-60回

### 定性的効果
- 保守性の向上
- 可読性の向上
- テスト容易性の向上
- 型安全性の向上
- パフォーマンスの改善

---

## 🚨 リスクと対策

### リスク
1. **既存機能の破壊**
   - 対策: 段階的実施、各Phase後の十分なテスト

2. **リファクタリング期間の延長**
   - 対策: Phaseごとのマイルストーン設定、定期的な進捗確認

3. **新機能開発の遅延**
   - 対策: 優先度の高いPhase 1-2を先行実施

### 緩和策
- 各Phaseを独立して実施可能な設計
- ロールバック可能なブランチ戦略
- 継続的な動作確認

---

## 📝 次のステップ

### 短期（1-2日）

1. **✅ Quick Win 1完了**
   - ✅ Hook Utilities基盤の実装完了
   - ✅ 3ファイルへの初期適用完了

2. **🔄 Phase 2の継続**
   - `useKeyboardShortcuts.ts`への適用（優先）
   - 他のhookファイル（20+）への順次展開
   - ボイラープレート削減の継続

### 中期（1-2週間）

1. **Phase 1の開始準備**
   - AdapterAccessorServiceの設計レビュー
   - 影響範囲の最終確認
   - テスト計画の策定

2. **Phase 2の完了**
   - 全hookファイルへのutilities適用完了
   - 削減効果の測定と検証

### 長期（1ヶ月）

1. **Phase 3-6の順次実施**
   - Node Utils再編
   - 大規模Hook分割
   - Component分割
   - Type Safety改善

2. **ドキュメント更新**
   - ARCHITECTURE.mdの更新
   - 各Phase完了後のREADME更新

3. **チーム共有**
   - リファクタリング計画の共有
   - 質問・フィードバックの収集

---

**作成日**: 2025-10-10
**最終更新**: 2025-10-10
**対象コードベース**: Mindoodle frontend
**目標**: 20%のコード削減（5,000行）
**現在の進捗**: 7行削減（0.14%完了）
