# Mindoodle

ローカルのMarkdownファイルをマインドマップ化するWebアプリ

## 🌐 使ってみる

**[https://sk0ya.github.io/Mindoodle/](https://sk0ya.github.io/Mindoodle/)**

ブラウザで開いて、フォルダへのアクセスを許可するだけで使えます。
インストール不要、完全にローカルで動作します。

## 特徴

### 1. ローカルのMarkdownファイルのマインドマップ化

- 既存のMarkdownファイルをそのままマインドマップとして表示・編集
- マインドマップで編集しても、Markdownファイルが更新される（双方向同期）
- 他のエディタと併用可能、データは完全にあなたのもの

### 2. Vimキーバインドによる操作

- `h/j/k/l` でノード間を移動
- `dd` でノード削除、`za` で折りたたみトグル
- キーボードだけで完結する高速操作
- Vimmerならすぐに使える

## ドキュメント

- [Vimキーバインド一覧](docs/vim-keybindings.md)
- [通常ショートカット一覧](docs/shortcuts.md)

## 技術構成

- React 18.2 + TypeScript 5.8
- Vite 6.3
- CodeMirror 6.0 (@replit/codemirror-vim)
- Zustand (状態管理)

## ライセンス

MIT License
