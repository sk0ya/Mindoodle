# Mindoodle 通常ショートカット（非 Vim）

現行実装の通常ショートカットをまとめた早見表です。

## ナビゲーション

| キー | 動作 |
|---|---|
| zt | Position the selected node at the left-center of the viewport |
| nav | Navigate to adjacent nodes in the specified direction |
| move | Navigate to adjacent nodes in the specified direction |
| go | Navigate to adjacent nodes in the specified direction |
| arrow | Navigate using arrow keys |
| select | Select a specific node by ID |
| focus | Select a specific node by ID |
| find | Find a node by text content |
| search | Find a node by text content |
| zoom+ | Zoom in on the mindmap |
| zi | Zoom in on the mindmap |
| zoom- | Zoom out on the mindmap |
| zoom-fit | Reset zoom to fit all nodes |
| fit | Reset zoom to fit all nodes |
| ctrl-u | Pan the mindmap view up |
| ctrl-d | Pan the mindmap view down |
| center-select | Select the node closest to the center of the visible viewport |
| vim-m | Select the node closest to the center of the visible viewport |
| next-map | Switch to the next map in the workspace (vim gt) |
| prev-map | Switch to the previous map in the workspace (vim gT) |
| 0 | Select the root node of the currently selected node |
| current-root | Select the root node of the currently selected node |

## 編集

| キー | 動作 |
|---|---|
| delete-node | Delete the selected node |
| remove | Delete the selected node |
| italic | Toggle italic formatting (*text*) |
| i-format | Toggle italic formatting (*text*) |
| copy-text | Copy node text only (without markdown formatting) to system clipboard |
| paste-sibling-after | Paste as younger sibling (after selected node) |
| paste-sibling-before | Paste as elder sibling (before selected node) |
| edit-start | Start editing the selected node |
| edit-end | Start editing with cursor at the end of node text |
| convert-markdown | Convert markdown heading to list |
| md-convert | Convert markdown heading to list |

## 構造

| キー | 動作 |
|---|---|
| split-map | ノードとその子要素を別のマップに変換 |
| extract-map | ノードとその子要素を別のマップに変換 |
| child | Add a new child node to the selected node |
| tab | Add a new child node to the selected node |
| sibling | Add a new sibling node after the selected node |
| enter | Add a new sibling node after the selected node |
| >> | Move the selected node as a child of its previous sibling |
| << | Move the selected node as the next sibling of its parent |
| layout | Auto-arrange nodes with optimal layout |
| arrange | Auto-arrange nodes with optimal layout |

## utility

| キー | 動作 |
|---|---|
| workspace-add | Add a new workspace by selecting a folder |
| ws-add | Add a new workspace by selecting a folder |
| new-mindmap | Create a new mindmap |
| create | Create a new mindmap |
| reset | Clear the current mindmap |
| clear-all | Clear the current mindmap |
| statistics | Show mindmap statistics |
| info | Show mindmap statistics |
| set-theme | Change mindmap theme |
| ? | Toggle keyboard shortcuts help panel |
| keyboard-help | Toggle keyboard shortcuts help panel |
| close | Close all open panels and overlays |
| escape | Close all open panels and overlays |

## アプリケーション

| キー | 動作 |
|---|---|
| map-next | Switch current map by id or direction |
| map-prev | Switch current map by id or direction |
| switchmap | Switch current map by id or direction |

## UI

| キー | 動作 |
|---|---|
| knowledge-graph | Show workspace knowledge graph in 3D |
| kg | Show workspace knowledge graph in 3D |
| graph | Show workspace knowledge graph in 3D |
| toggle-md | Toggle Markdown panel visibility |
| md-panel | Toggle Markdown panel visibility |
| toggle-node-note | Toggle Selected Node Note panel visibility |
| node-note-panel | Toggle Selected Node Note panel visibility |
| vim-settings | Toggle Vim settings panel visibility |
| vim-panel | Toggle Vim settings panel visibility |



最終更新: 2025-10-15
