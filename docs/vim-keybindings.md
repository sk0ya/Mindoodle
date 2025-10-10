# Mindoodle マインドマップ Vim キーバインド（早見表）

Vim 風のショートカット一覧です。

## 基本の考え方

- モードは Normal 前提
- 主要移動: h/j/k/l

## ナビゲーション

| キー | 動作 |
|---|---|
| zz | Center the selected node in the viewport |
| center-node | Center the selected node in the viewport |
| k | Navigate up to the previous sibling node |
| j | Navigate down to the next sibling node |
| d | Navigate down to the next sibling node |
| h | Navigate left to the parent node |
| parent | Navigate left to the parent node |
| l | Navigate right to the first child node |
| root | Select and center the root node |
| go-root | Select and center the root node |
| gg | Select and center the root node |
| vim-G | Select the visible node positioned lowest in the map |
| G | Select the visible node positioned lowest in the map |

## 編集

| キー | 動作 |
|---|---|
| ciw | Clear node text and start editing |
| change | Clear node text and start editing |
| clear-edit | Clear node text and start editing |
| i | Start editing the selected node |
| a | Create a child node and start editing |
| A | Start editing at the end of the node text |
| I | Start editing at the beginning of the node text |
| dd | Cut the selected node (copy then delete) |
| cut-node | Cut the selected node (copy then delete) |
| bold | Toggle bold formatting (**text**) |
| B | Toggle bold formatting (**text**) |
| strikethrough | Toggle strikethrough formatting (~~text~~) |
| strike | Toggle strikethrough formatting (~~text~~) |
| S | Toggle strikethrough formatting (~~text~~) |
| i | Start editing at the beginning of node text (vim i) |
| insert-start | Start editing at the beginning of node text (vim i) |
| a | Start editing at the end of node text (vim a) |
| insert-end | Start editing at the end of node text (vim a) |
| o | Create new younger sibling node and start editing (vim o) |
| add-younger-sibling | Create new younger sibling node and start editing (vim o) |
| O | Create new elder sibling node and start editing (vim O) |
| add-elder-sibling | Create new elder sibling node and start editing (vim O) |
| X | Add a new checkbox list child node, positioning before heading nodes |
| add-checkbox-child | Add a new checkbox list child node, positioning before heading nodes |
| u | Undo the last operation |
| r | Redo the last undone operation |
| c | Copy the selected node |
| v | Paste copied node as child |

## 構造

| キー | 動作 |
|---|---|
| m | Convert node type (e.g., heading to list) |
| convert-type | Convert node type (e.g., heading to list) |
| za | Toggle the collapse state of node children |
| toggle-collapse | Toggle the collapse state of node children |
| fold | Toggle the collapse state of node children |
| zo | Expand the selected node to show its children |
| open-fold | Expand the selected node to show its children |
| zc | Collapse the selected node to hide its children |
| close-fold | Collapse the selected node to hide its children |
| zR | Expand all nodes in the mindmap |
| open-all-folds | Expand all nodes in the mindmap |
| zM | Collapse all nodes in the mindmap |
| close-all-folds | Collapse all nodes in the mindmap |
| x | Toggle checkbox state of a list node, or convert to checkbox list |
| checkbox-toggle | Toggle checkbox state of a list node, or convert to checkbox list |



最終更新: 2025-10-11
