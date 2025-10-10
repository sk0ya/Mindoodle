# Mindoodle Documentation

このディレクトリには、Mindoodleプロジェクトの技術ドキュメントが含まれています。

---

## 📚 ドキュメント一覧

### アーキテクチャ・設計
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - プロジェクト全体のアーキテクチャ設計書
  - ディレクトリ構造
  - アーキテクチャパターン（Command Pattern, Event Strategy, Service Layer）
  - 技術スタック
  - コア機能の説明

- **[RESTRUCTURE.md](./RESTRUCTURE.md)** - 構造再設計計画
  - 型安全化計画（Strict Mode対応）
  - 現在の課題と対応方針

### リファクタリング計画 🆕
- **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)** - 包括的リファクタリング計画
  - 現状分析（コードベース規模、重複パターン）
  - 6フェーズのリファクタリング戦略
  - 20%コード削減目標（5,000行）
  - タイムラインと検証方法

- **[REFACTORING_QUICK_WINS.md](./REFACTORING_QUICK_WINS.md)** - Quick Wins実装ガイド
  - 即効性の高い5つの改善
  - 具体的な実装コード例
  - 段階的実施ガイド
  - 1,050行削減（目標の21%）

- **[DUPLICATION_ANALYSIS.md](./DUPLICATION_ANALYSIS.md)** - 重複コード詳細分析
  - 統計サマリー（"as any" 251箇所、useCallback 115箇所など）
  - Critical Issues（最優先修正項目）
  - ファイル別・パターン別重複リスト
  - 削減見込みの詳細データ

### 機能実装
- **[KNOWLEDGE_GRAPH_2D_IMPLEMENTATION.md](./KNOWLEDGE_GRAPH_2D_IMPLEMENTATION.md)** - 2D知識グラフ実装ドキュメント
  - 実装の詳細
  - アーキテクチャ
  - 技術選定の理由

### ユーザーガイド
- **[shortcuts.md](./shortcuts.md)** - キーボードショートカット一覧
  - 全機能のショートカットキー
  - カテゴリ別整理

- **[vim-keybindings.md](./vim-keybindings.md)** - Vimキーバインディング
  - Vimモード操作説明
  - カスタムマッピング

---

## 🎯 リファクタリングを始める方へ

### ステップ1: 全体像を理解する
1. [ARCHITECTURE.md](./ARCHITECTURE.md) でプロジェクト構造を把握
2. [DUPLICATION_ANALYSIS.md](./DUPLICATION_ANALYSIS.md) で問題箇所を確認

### ステップ2: Quick Winsから開始
1. [REFACTORING_QUICK_WINS.md](./REFACTORING_QUICK_WINS.md) を読む
2. **Quick Win 1**: Adapter Accessor Utility から実装開始
3. 各Quick Winを順番に実施（推定1-2週間）

### ステップ3: フルプランへ展開
1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) のPhase 1-6を実施
2. マイルストーンごとに検証
3. 合計20%のコード削減を達成（推定3-4週間）

---

## 📊 プロジェクト状況（2025-10-10時点）

### コードベース規模
- **総行数**: ~25,000行
- **主要ファイル数**: 200+
- **平均ファイルサイズ**: 125行

### 主要な課題
1. **巨大ファイル**: 10ファイルが500行以上
2. **重複パターン**: Adapter取得（20+箇所）、useCallback（115箇所）
3. **型安全性**: "as any" が251箇所
4. **責務混在**: 特にnodeUtils.ts（1,149行）、useMindMap.ts（787行）

### リファクタリング目標
- **削減目標**: 5,000行（20%）
- **Quick Wins**: 1,050行削減可能
- **総削減見込み**: 6,050行（24%）+ 安全マージン

---

## 🔍 ドキュメント更新履歴

| 日付 | ドキュメント | 更新内容 |
|------|------------|----------|
| 2025-10-10 | REFACTORING_*.md | リファクタリング計画3部作を作成 |
| 2025-10-09 | KNOWLEDGE_GRAPH_2D_IMPLEMENTATION.md | 2D知識グラフ実装を追加 |
| 2025-10-05 | RESTRUCTURE.md | 型安全化計画を追加 |
| 2025-10-05 | ARCHITECTURE.md | 最近のアーキテクチャ改善を反映 |

---

## 📝 ドキュメント作成ガイドライン

### 新しいドキュメントを追加する場合
1. `docs/` ディレクトリに `.md` ファイルを作成
2. このREADME.mdに追加
3. 関連ドキュメントへのリンクを追加
4. 更新履歴を記録

### ドキュメント命名規則
- 英語大文字 + アンダースコア（例: `FEATURE_NAME.md`）
- 日本語でも可（例: `機能名.md`）
- 明確で検索しやすい名前を使用

---

## 🔗 関連リソース

### 外部リンク
- [プロジェクトリポジトリ](https://github.com/your-org/mindoodle)（該当する場合）
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)

### 内部リンク
- [Frontend README](../frontend/README.md)
- [Root CLAUDE.md](../CLAUDE.md)

---

**最終更新**: 2025-10-10
**メンテナ**: Development Team
