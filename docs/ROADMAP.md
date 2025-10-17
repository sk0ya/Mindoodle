# Mindoodle Development Roadmap

このドキュメントは、Mindoodleの今後の発展戦略と実装計画をまとめたものです。

## 目次

- [Phase 1: 基盤強化（即座～3ヶ月）](#phase-1-基盤強化即座3ヶ月)
- [Phase 2: 機能拡張（3～6ヶ月）](#phase-2-機能拡張36ヶ月)
- [Phase 3: エコシステム構築（6～12ヶ月）](#phase-3-エコシステム構築612ヶ月)
- [差別化戦略](#差別化戦略)
- [最初のステップ](#最初のステップ)

---

## Phase 1: 基盤強化（即座～3ヶ月）

### 1. コード品質の改善 🔧

#### 現状の課題
- 多数の関数が複雑度15を超過（Cognitive Complexity）
  - `markdownImporter.ts`: 最大75
  - `normalizedStore.ts`: 最大30
  - `MarkdownFolderAdapter.ts`: 最大34
- テストカバレッジ0%
- 保守性とバグリスクの懸念

#### 具体的アクション
- [ ] **Vitest + React Testing Libraryの導入**
  - テスト環境のセットアップ
  - テストヘルパーとモックの整備
  - CI統合

- [ ] **高複雑度関数のリファクタリング**
  - **優先度1**: `markdownImporter.ts`
    - パース処理を状態機械パターンで書き直し
    - 関数を純粋関数に分割（最大15行/関数）
    - テストカバレッジ90%+
  - **優先度2**: `normalizedStore.ts`
    - データ操作を小さな責務に分離
    - Immer活用で不変性を保証
  - **優先度3**: `MarkdownFolderAdapter.ts`
    - ファイル操作をService Layerに分離
    - エラーハンドリングの統一

- [ ] **テストカバレッジ目標**
  - Services: 80%+
  - Selectors: 90%+
  - Utils: 85%+
  - Stores: 70%+
  - 全体: 70%+

#### 期待効果
- ✅ 保守性の向上
- ✅ バグ減少
- ✅ リファクタリングの安全性確保
- ✅ 新規コントリビューターの参加ハードル低下

---

### 2. CI/CDパイプライン ⚙️

#### 実装内容
- [ ] **GitHub Actions設定**
  - Lint + 型チェック + テスト
  - PRごとの自動実行
  - カバレッジレポート生成

- [ ] **品質ゲート**
  - テスト失敗時はマージ不可
  - カバレッジ閾値（70%）
  - Lint警告ゼロ

- [ ] **自動デプロイ**
  - GitHub Pages（`main`ブランチ）
  - プレビュー環境（PR単位）

#### 期待効果
- ✅ 品質の自動保証
- ✅ デプロイの自動化
- ✅ レビュープロセスの効率化

---

## Phase 2: 機能拡張（3～6ヶ月）

### 1. プラグインシステム 🔌

#### 設計コンセプト
既存のCommand Patternを活用し、プラグインが独自コマンドを登録できる仕組み。

#### アーキテクチャ
```typescript
// Plugin Manifest (plugin.json)
{
  "name": "notion-sync",
  "version": "1.0.0",
  "description": "Sync with Notion databases",
  "author": "community",
  "commands": [
    {
      "name": "export-to-notion",
      "category": "export",
      "description": "Export current map to Notion"
    }
  ],
  "permissions": ["network", "storage"],
  "main": "dist/index.js"
}

// Plugin Entry Point (index.ts)
export default class NotionSyncPlugin {
  onLoad(registry: CommandRegistry) {
    registry.register({
      name: 'export-to-notion',
      execute: async (context) => {
        // Implementation
      },
      guard: (context) => context.selectedNodeId != null
    });
  }

  onUnload() {
    // Cleanup
  }
}
```

#### プラグイン例
- **エクスポートプラグイン**
  - PDF, PNG, SVG出力
  - Mermaid diagram生成
  - PowerPoint/Keynote変換

- **外部サービス連携**
  - Notion Sync
  - Obsidian互換
  - Roam Research形式
  - GitHub Issues/Projects

- **ビジュアライゼーション**
  - カスタムノードスタイル
  - アニメーション
  - 3Dビュー

- **生産性向上**
  - テンプレート管理
  - スニペット
  - マクロ実行

#### 実装ステップ
- [ ] プラグインAPIの設計
- [ ] サンドボックス実行環境
- [ ] プラグインローダー
- [ ] 設定UI
- [ ] ドキュメント作成
- [ ] サンプルプラグイン3つ作成

---

### 2. AI機能の強化 🤖

#### 既存のベース
- `EmbeddingService`: Vector embeddings生成
- `VectorStore`: 類似度検索
- Ollama統合（ローカルLLM）

#### 拡張機能

##### 2.1 セマンティック検索
- [ ] ノード内容のベクトル化
- [ ] 類似ノード検索UI
- [ ] 関連ノード自動表示

##### 2.2 自動整理機能
- [ ] 自動タグ付け
- [ ] カテゴリ分類
- [ ] 階層構造の提案

##### 2.3 コンテンツ生成
- [ ] ノードの要約生成
- [ ] 子ノード展開の提案
- [ ] テキスト補完

##### 2.4 インタラクティブAI
- [ ] マインドマップ全体への質問応答
- [ ] 「このトピックについて詳しく教えて」機能
- [ ] 関連情報の自動検索

#### 技術スタック
- @xenova/transformers（既存）
- Ollama（ローカルLLM）
- OpenAI API（オプション）

---

### 3. パフォーマンス最適化 ⚡

#### 目標
- 10,000+ノードで60fps維持
- 初期ロード時間 < 2秒
- メモリ使用量の削減

#### 最適化手法

##### 3.1 Web Worker化
- [ ] テキスト計測をWorkerに移動
  - `nodeUtils.ts`のCanvas API呼び出し
  - レイアウト計算のオフスレッド化
- [ ] Embedding計算のWorker化

##### 3.2 仮想化
- [ ] react-window導入
- [ ] ビューポート外ノードのDOM除外
- [ ] 遅延レンダリング

##### 3.3 キャッシュ戦略
- [ ] 計算済みレイアウトのキャッシュ
- [ ] ノードサイズの事前計算
- [ ] Memoization戦略の見直し

##### 3.4 測定とモニタリング
- [ ] Performance API統合
- [ ] レンダリング時間の計測
- [ ] メモリプロファイリング

---

## Phase 3: エコシステム構築（6～12ヶ月）

### 1. リアルタイムコラボレーション 👥

#### 技術選定
- **Yjs**: CRDT（Conflict-free Replicated Data Type）
- **WebRTC or WebSocket**: リアルタイム通信
- **ローカルファースト維持**: オフライン優先、後で同期

#### 機能
- [ ] リアルタイム共同編集
- [ ] カーソル位置の共有
- [ ] コメント・提案機能
- [ ] 変更履歴の可視化
- [ ] 非同期コラボレーション対応

#### 実装ステップ
- [ ] Yjs統合
- [ ] 同期プロトコル設計
- [ ] Presence（誰がどこを見ているか）
- [ ] Conflict resolution UI

---

### 2. モバイル対応 📱

#### PWA強化
- [ ] Service Workerの最適化
- [ ] オフライン対応
- [ ] ホーム画面追加
- [ ] プッシュ通知

#### タッチUI
- [ ] タッチジェスチャー
  - ピンチズーム
  - スワイプナビゲーション
  - ロングタップメニュー
- [ ] レスポンシブレイアウト
- [ ] モバイル専用ショートカット

#### ネイティブアプリ（検討）
- React Native版
- Capacitor統合

---

### 3. プラグインマーケットプレイス 🏪

#### 機能
- [ ] プラグイン検索・インストール
- [ ] レビュー・評価システム
- [ ] 自動更新
- [ ] 依存関係管理
- [ ] セキュリティスキャン

#### コミュニティ構築
- [ ] プラグイン開発ガイド
- [ ] テンプレートリポジトリ
- [ ] Discord/Slackコミュニティ
- [ ] 月次ハイライト

---

## 差別化戦略

### 競合分析

| 機能 | Mindoodle | Obsidian Canvas | Notion | Miro | XMind |
|------|-----------|-----------------|--------|------|-------|
| **完全ローカル** | ✅ | ✅ | ❌ | ❌ | △ |
| **Markdownネイティブ** | ✅ | △ | ❌ | ❌ | ❌ |
| **Vimバインド** | ✅ | △ | ❌ | ❌ | ❌ |
| **プラグイン可能** | 🔜 Phase 2 | ✅ | △ | ❌ | ❌ |
| **リアルタイム共同編集** | 🔜 Phase 3 | ❌ | ✅ | ✅ | △ |
| **AI統合** | 🔜 Phase 2 | △ | ✅ | △ | ❌ |
| **オープンソース** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **API-first** | ✅ | △ | ✅ | △ | ❌ |

### ターゲット市場

#### 1. 開発者・エンジニア 💻
**強み:**
- Vimキーバインド
- プログラマブル（プラグインAPI）
- Git-friendly（Markdownファイル）
- TypeScript製（貢献しやすい）

**訴求点:**
- "コードを書くようにマインドマップを作る"
- ドキュメント駆動開発のツール
- 技術記事のアウトライン作成

#### 2. プライバシー重視層 🔒
**強み:**
- 完全ローカル動作
- オープンソース（監査可能）
- データ所有権

**訴求点:**
- "あなたのデータはあなたのもの"
- 機密情報の安全な管理
- ベンダーロックインなし

#### 3. PKM（Personal Knowledge Management）愛好家 📚
**強み:**
- Markdown互換（Obsidian, Logseq等と共存）
- ローカルファイルベース
- リンク・タグシステム

**訴求点:**
- 既存のPKMワークフローに統合
- Zettelkasten方式との親和性
- 知識グラフの可視化

---

## 最初のステップ（今週～来月）

### Week 1-2: テスト基盤
- [ ] Vitest + React Testing Library導入
- [ ] テストヘルパー作成
- [ ] 最初のテスト10個（Services優先）

### Week 3-4: リファクタリング開始
- [ ] `markdownImporter.ts`の分析
- [ ] パース処理の状態機械設計
- [ ] 最初の関数のリファクタ + テスト

### Week 5-6: CI/CD
- [ ] GitHub Actions設定
- [ ] 品質ゲート設定
- [ ] ドキュメント更新

### Week 7-8: プラグインAPI設計
- [ ] API仕様書作成
- [ ] プラグインローダーのプロトタイプ
- [ ] サンプルプラグイン1つ

---

## 成功指標（KPI）

### Phase 1
- ✅ テストカバレッジ 70%+
- ✅ Cognitive Complexity平均 < 15
- ✅ CI/CDパイプライン稼働率 > 95%

### Phase 2
- ✅ プラグイン数 10+
- ✅ AI機能利用率 > 40%
- ✅ 10,000ノードで60fps達成

### Phase 3
- ✅ アクティブユーザー 10,000+
- ✅ コミュニティプラグイン 50+
- ✅ GitHub Stars 5,000+

---

## リスクと対策

### リスク1: リファクタリング中のバグ増加
**対策:**
- テストファースト
- 段階的な移行
- フィーチャーフラグ

### リスク2: プラグインエコシステムの立ち上がり遅延
**対策:**
- 公式プラグインを10個作成
- ドキュメント充実
- インセンティブプログラム

### リスク3: パフォーマンス目標未達
**対策:**
- 早期の測定と最適化
- 仮想化の優先実装
- Web Worker化の段階的導入

---

## 貢献方法

このロードマップに貢献したい場合：
1. [GitHub Issues](https://github.com/sk0ya/Mindoodle/issues)で議論
2. [Discord](#)コミュニティに参加（準備中）
3. PRを作成（ [CONTRIBUTING.md](../CONTRIBUTING.md) 参照）

---

**最終更新**: 2025-10-17
**ドキュメントバージョン**: 1.0.0
