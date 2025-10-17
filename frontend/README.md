# Mindoodle Frontend

React + TypeScript + Vite による Mindoodle のフロントエンドアプリケーション。

## 開発環境

### 必要な環境
- Node.js 18.x 以上
- npm 9.x 以上

### セットアップ
```bash
npm install
```

## 開発コマンド

### 開発サーバー
```bash
npm run dev  # http://localhost:5174 で起動
```

### ビルド
```bash
npm run build       # 本番ビルド
npm run build:full  # ドキュメント生成 + 検証 + ビルド
npm run preview     # ビルドのプレビュー
```

### テスト
```bash
npm test              # テストをWatch modeで実行
npm run test:run      # テストを1回実行
npm run test:ui       # Vitest UIでテスト実行
npm run test:coverage # カバレッジレポート生成
```

### コード品質
```bash
npm run lint          # ESLintでコードチェック
npm run lint:fix      # ESLint自動修正
npm run type-check    # TypeScriptの型チェック
npm run validate      # 型安全性の検証
```

### ドキュメント
```bash
npm run docs:generate # ショートカットドキュメント生成
npm run docs:watch    # ドキュメント自動生成（watch mode）
```

## プロジェクト構造

```
src/
├── app/
│   ├── commands/      # Command Pattern実装
│   ├── core/          # コアアーキテクチャ
│   ├── features/      # 機能別実装
│   │   └── mindmap/   # マインドマップ機能
│   └── shared/        # 共有リソース
└── test/              # テストユーティリティ
```

詳細は [CLAUDE.md](../CLAUDE.md) および [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) を参照してください。

## テスト

- **テストフレームワーク**: Vitest
- **テストライブラリ**: @testing-library/react
- **カバレッジ目標**: 70%+

テストファイルは各モジュールと同じディレクトリに `*.test.ts(x)` として配置します。

### テストの書き方

```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    // テストコード
  });
});
```

## ライセンス

MIT
