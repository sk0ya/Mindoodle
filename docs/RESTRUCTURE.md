# 構造再設計 — アクティブタスク

進行中の構造改善タスクと型安全化計画。

最終更新: 2025-10-05

## アーキテクチャ概要

現在採用しているパターン:

- **Command Pattern**: 全操作を `@commands/system/registry` 経由で実行
- **Event Strategy**: モード別イベント処理（Normal/Insert/Visual）
- **Service Layer**: Navigation, Viewport, Clipboard, EditingState
- **Selector Pattern**: ノードクエリと状態派生
- **State Machines**: `uiModeMachine` と `panelManager`

詳細は `docs/ARCHITECTURE.md` を参照。

---

## 型安全化計画（Strict Mode 対応）

### 現状

`npm run type-check:strict` で `exactOptionalPropertyTypes` 起因のエラーが存在。

### 短期（Baseline）

- `npm run type-check` を CI/PR の必須チェックに維持
- `build` では `validate` のみをゲート

### 中期（Strict 対応）— 推奨順序

1. `shared/types` と `core/storage`（エラー少・波及多）
2. `features/mindmap/utils` と `selectors`（値チェック追加）
3. `markdown/**`（パーサ周りの undefined 扱いの整理）
4. `nodeSlice/historySlice`（`undefined` を許容しない型へ修正）

### 対応パターン指針

- `T | undefined` を公開型で返さない
- `prop?: T` に `undefined` をそのまま渡さない
- `fetch` の `RequestInit` で `undefined` の場合はプロパティ自体を省略

---

## 検証・実行手順

```bash
cd frontend/

# 型チェック
npm run type-check          # 標準（CI基準）
npm run type-check:strict   # Strict Mode（改善中）

# Lint & Build
npm run lint
npm run build

# ドキュメント生成
npm run docs:generate
```
