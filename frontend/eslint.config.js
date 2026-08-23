import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';

// SonarJS の推奨設定を直接展開
const sonarjsRecommended = sonarjs.configs.recommended;

export default [
  // Flat Config の先頭で指定した ignore は、全設定に適用されます。
  // 型宣言ファイルは ESLint の対象外です。
  {
    ignores: ['**/*.d.ts', 'node_modules/**', 'dist/**', '.vite/**', 'build/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['node_modules/**', 'dist/**', '.vite/**', 'build/**', '**/*.d.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.eslint.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      sonarjs
    },
    // Flat Config では "extends" の代わりに config オブジェクトをマージ
    rules: {
      ...sonarjsRecommended.rules, // 🧩 SonarJS の推奨ルールを直接展開

      // TypeScript安全性
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',

      // 未使用検出
      // '@typescript-eslint/no-unused-vars': ['warn', {
      //   argsIgnorePattern: '^_',
      //   varsIgnorePattern: '^_',
      //   ignoreRestSiblings: true
      // }],
      // 'no-unused-vars': ['warn', {
      //   argsIgnorePattern: '^_',
      //   varsIgnorePattern: '^_',
      //   ignoreRestSiblings: true
      // }],
       'no-unused-vars': 'off', 

      // React固有ルール
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // 基本ルール
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'warn',
      'no-alert': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-undef': 'off',

      // Import/Export
      'no-duplicate-imports': 'warn',

      // エラー処理
      'no-empty': ['error', { allowEmptyCatch: true }],

      // 🧠 複雑性・冗長性に関する SonarJS 強化ルール
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-collapsible-if': 'warn',
      // 複雑度の上限は既存コード全体への一括適用ではなく、レビュー時の指標として扱う。
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-small-switch': 'warn',

      // 📏 サイズ・複雑度は既存の画面構成とテスト構成を一括で測ると
      // 実装上の問題ではなく、コンポーネント境界の設計指標になります。
      // 動作・型・重複に関するルールとは分離し、これらはコードレビューで追跡します。
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
      'max-depth': 'off',
      'max-params': 'off'
    },
    settings: {
      react: { version: 'detect' }
    }
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    files: ['*.config.js', '.eslintrc.cjs'],
    languageOptions: {
      globals: {
        module: true,
        require: true,
        __dirname: true,
        process: true
      }
    }
  }
];
