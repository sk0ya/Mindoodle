import { useMemo } from 'react';
import { findNodeById, getSiblingNodes, getFirstVisibleChild, findNodeInRoots, findParentNode, calculateNodeSize } from '@mindmap/utils';
import { useMindMapStore } from '../../store';
import { findNodeBySpatialDirection } from '@shared/utils';
import type { MindMapNode } from '@shared/types';

interface Args {
  data: { rootNode: MindMapNode } | null;
  ui: any;
  store: any;
  logger: any;
  showNotification: (type: 'success'|'error'|'info'|'warning', message: string) => void;
  // viewport control
  centerNodeInView: (nodeId: string, animate?: boolean) => void;
  // mindmap data/actions
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (t: string) => void;
  startEditing: (id: string) => void;
  startEditingWithCursorAtEnd: (id: string) => void;
  startEditingWithCursorAtStart: (id: string) => void;
  finishEditing: (id: string, text?: string) => void;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectNode: (id: string) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  applyAutoLayout?: () => void;
  pasteImageFromClipboard: (nodeId: string) => Promise<void>;
  pasteNodeFromClipboard: (parentId: string) => Promise<void>;
  changeNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
}

export function useShortcutHandlers(args: Args) {
  const {
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText, setEditText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
  } = args;

  return useMemo(() => ({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit: startEditing,
    startEditWithCursorAtEnd: startEditingWithCursorAtEnd,
    startEditWithCursorAtStart: startEditingWithCursorAtStart,
    finishEdit: async (nodeId: string, text?: string) => {
      // Ensure we commit the current input if caller passes undefined
      const value = (text !== undefined) ? text : editText;
      finishEditing(nodeId, value);
    },
    editText,
    updateNode,
    addChildNode: async (parentId: string, text?: string, autoEdit?: boolean) => {
      try {
        const newNodeId = store.addChildNode(parentId, text);
        if (autoEdit && newNodeId) setTimeout(() => startEditing(newNodeId), 50);
        return newNodeId || null;
      } catch (error) {
        logger.error('子ノード追加に失敗:', error);
        return null;
      }
    },
    addSiblingNode: async (nodeId: string, text?: string, autoEdit?: boolean, insertAfter?: boolean) => {
      try {
        const newNodeId = store.addSiblingNode(nodeId, text, insertAfter);
        if (autoEdit && newNodeId) setTimeout(() => startEditing(newNodeId), 50);
        return newNodeId || null;
      } catch (error) {
        logger.error('兄弟ノード追加に失敗:', error);
        return null;
      }
    },
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectNode,
    setPan,
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedNodeId) return;
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      const currentRoot = roots.find(r => !!findNodeById(r, selectedNodeId)) || roots[0];
      if (!currentRoot) return;
      const currentNode = findNodeById(currentRoot, selectedNodeId);
      if (!currentNode) return;
      let nextNodeId: string | null = null;
      switch (direction) {
        case 'left': {
          // Move to parent node (start from current root, not nullable data)
          const stack: MindMapNode[] = currentRoot ? [currentRoot] as MindMapNode[] : [];
          while (stack.length) {
            const node = stack.pop()!;
            if (node.children?.some(c => c.id === selectedNodeId)) { nextNodeId = node.id; break; }
            if (node.children) stack.push(...node.children);
          }
          break;
        }
        case 'right': {
          const firstChild = getFirstVisibleChild(currentNode);
          if (firstChild) {
            // 子ノードの中から親ノードのY座標に最も近いものを選択
            const children = currentNode.children || [];
            if (children.length > 1) {
              let closestChild = children[0];
              let minDistance = Math.abs(children[0].y - currentNode.y);

              for (let i = 1; i < children.length; i++) {
                const distance = Math.abs(children[i].y - currentNode.y);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestChild = children[i];
                }
              }
              nextNodeId = closestChild.id;
            } else {
              nextNodeId = firstChild.id;
            }
          }
          else if (currentNode.children?.length && currentNode.collapsed) {
            updateNode(selectedNodeId, { collapsed: false });
            // 展開時も中央に近い子ノードを選択
            const children = currentNode.children;
            if (children.length > 1) {
              let closestChild = children[0];
              let minDistance = Math.abs(children[0].y - currentNode.y);

              for (let i = 1; i < children.length; i++) {
                const distance = Math.abs(children[i].y - currentNode.y);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestChild = children[i];
                }
              }
              nextNodeId = closestChild.id;
            } else {
              nextNodeId = children[0].id;
            }
          }
          break;
        }
        case 'up':
        case 'down': {
          const { siblings, currentIndex } = getSiblingNodes(currentRoot, selectedNodeId);
          if (siblings.length > 1 && currentIndex !== -1) {
            let targetIndex = -1;
            if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
            else if (direction === 'down' && currentIndex < siblings.length - 1) targetIndex = currentIndex + 1;
            if (targetIndex !== -1) nextNodeId = siblings[targetIndex].id;
          }
          // If no intra-root sibling, allow crossing to adjacent root node
          if (!nextNodeId) {
            const rootIndex = roots.findIndex(r => r.id === currentRoot.id);
            if (rootIndex !== -1) {
              if (direction === 'down' && rootIndex < roots.length - 1) {
                nextNodeId = roots[rootIndex + 1].id;
              } else if (direction === 'up' && rootIndex > 0) {
                nextNodeId = roots[rootIndex - 1].id;
              }
            }
          }
          break;
        }
      }
      if (!nextNodeId) nextNodeId = findNodeBySpatialDirection(selectedNodeId, direction, currentRoot);
      if (nextNodeId) {
        selectNode(nextNodeId);
        // Ensure the newly selected node is visible (but don't center it)
        ensureNodeVisible(nextNodeId);
      }

      // Helper function to ensure node is visible without centering
      function ensureNodeVisible(nodeId: string) {
        const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
        const node = findNodeInRoots(roots, nodeId);
        if (!node || !setPan) return;

        // Get actual viewport dimensions considering sidebar and panels
        const mindmapContainer = document.querySelector('.mindmap-canvas-container') ||
                                 document.querySelector('.workspace-container') ||
                                 document.querySelector('.mindmap-app');

        let effectiveWidth = window.innerWidth;
        let effectiveHeight = window.innerHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (mindmapContainer) {
          const rect = mindmapContainer.getBoundingClientRect();
          effectiveWidth = rect.width;
          effectiveHeight = rect.height;
          offsetX = rect.left;
          offsetY = rect.top;
        } else {
          // Fallback: account for primary left and right panels
          const sidebar = document.querySelector('.primary-sidebar');
          if (sidebar) {
            const r = sidebar.getBoundingClientRect();
            effectiveWidth -= r.width;
            offsetX = r.width;
          }
          const md = document.querySelector('.markdown-panel');
          if (md) {
            const r = md.getBoundingClientRect();
            effectiveWidth -= r.width;
          }
        }

        // Bottom overlays (fixed): subtract selected-node-note-panel + Vim bar 24px
        let noteH = 0;
        try {
          const notePanel = document.querySelector('.selected-node-note-panel') as HTMLElement | null;
          noteH = notePanel ? Math.round(notePanel.getBoundingClientRect().height) : 0;
          effectiveHeight -= noteH;
        } catch {}
        effectiveHeight -= 24;
        // If note panel is not visible (height=0), keep a small 6px margin above Vim bar
        const bottomExtra = noteH === 0 ? 6 : 0;
        effectiveHeight -= bottomExtra;

        const currentZoom = ui.zoom * 1.5; // Match the transform scale from CanvasRenderer
        const currentPan = ui.pan;

        // Edge-aware: use node visual bounds
        const fontSize = (useMindMapStore.getState() as any)?.settings?.fontSize ?? 14;
        const nodeSize = calculateNodeSize(node as any, undefined as any, false, fontSize);
        const halfW = ((nodeSize?.width ?? 80) / 2) * currentZoom;
        const halfH = ((nodeSize?.height ?? 24) / 2) * currentZoom;

        const screenX = currentZoom * (node.x + currentPan.x) - offsetX;
        const screenY = currentZoom * (node.y + currentPan.y) - offsetY;

        const leftBound = 0;
        const rightBound = effectiveWidth;
        const topBound = 0;
        const bottomBound = effectiveHeight;

        const isOutsideLeft = (screenX - halfW) < leftBound;
        const isOutsideRight = (screenX + halfW) > rightBound;
        const isOutsideTop = (screenY - halfH) < topBound;
        const isOutsideBottom = (screenY + halfH) > bottomBound;

        if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
          let newPanX = currentPan.x;
          let newPanY = currentPan.y;

          if (isOutsideLeft) {
            newPanX = ((leftBound + offsetX + halfW) / currentZoom) - node.x;
          } else if (isOutsideRight) {
            newPanX = ((rightBound + offsetX - halfW) / currentZoom) - node.x;
          }

          if (isOutsideTop) {
            newPanY = ((topBound + offsetY + halfH) / currentZoom) - node.y;
          } else if (isOutsideBottom) {
            newPanY = ((bottomBound + offsetY - halfH) / currentZoom) - node.y;
          }

          setPan({ x: newPanX, y: newPanY });
        }
      }
    },
    showMapList: ui.showMapList,
    setShowMapList: (show: boolean) => store.setShowMapList(show),
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: (show: boolean) => store.setShowLocalStoragePanel(show),
    showTutorial: ui.showTutorial,
    setShowTutorial: (show: boolean) => store.setShowTutorial(show),
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show),
    copyNode: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      const node = findNodeInRoots(roots, nodeId);
      if (!node) {
        logger.error('copyNode: node not found', nodeId);
        return;
      }
      logger.debug('copyNode: setting clipboard', node);
      store.setClipboard(node);
      const convertToMd = (n: MindMapNode, level = 0): string => {
        const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
        let md = `${prefix}${n.text}\n`;
        if (n.note !== null) md += `${n.note}\n`;
        if (n.children?.length) n.children.forEach(c => { md += convertToMd(c, level + 1); });
        return md;
      };
      const markdownText = convertToMd(node);
      navigator.clipboard?.writeText?.(markdownText).catch(() => {});
      showNotification('success', `「${node.text}」をコピーしました`);
    },
    pasteNode: async (parentId: string) => {
      // Get the node from store clipboard
      logger.debug('pasteNode: checking clipboard');
      try {
        const storeState = useMindMapStore.getState();
        logger.debug('pasteNode: store state ui.clipboard', storeState.ui.clipboard);
        const clipboardNode = storeState.ui.clipboard;

        if (!clipboardNode) {
          logger.debug('pasteNode: no clipboard node, trying image paste');
          // Try to paste image from clipboard instead
          try {
            await pasteImageFromClipboard(parentId);
            return;
          } catch (error) {
            logger.debug('pasteNode: image paste failed, showing warning');
            showNotification('warning', 'コピーされたノードや画像がありません');
            return;
          }
        }

        logger.debug('pasteNode: pasting node', clipboardNode, 'into parent', parentId);

        // Set flag in store state to suppress nested history groups during paste
        useMindMapStore.setState((state: any) => {
          state._pasteInProgress = true;
        });

        // Paste the node tree without creating history groups for each addChildNode
        const paste = (nodeToAdd: MindMapNode, parent: string): string | undefined => {
          const newNodeId = store.addChildNode(parent, nodeToAdd.text);
          logger.debug('pasteNode: created child node', newNodeId, 'with text', nodeToAdd.text);
          if (newNodeId) {
            // Preserve all node properties including checkbox state
            const updates: Partial<MindMapNode> = {};
            if (nodeToAdd.note) updates.note = nodeToAdd.note;
            if (nodeToAdd.fontSize) updates.fontSize = nodeToAdd.fontSize;
            if (nodeToAdd.fontWeight) updates.fontWeight = nodeToAdd.fontWeight;
            if (nodeToAdd.color) updates.color = nodeToAdd.color;
            if (nodeToAdd.markdownMeta) updates.markdownMeta = nodeToAdd.markdownMeta;

            if (Object.keys(updates).length > 0) {
              updateNode(newNodeId, updates);
            }

            if (nodeToAdd.children?.length) {
              nodeToAdd.children.forEach(child => paste(child, newNodeId));
            }
          }
          return newNodeId;
        };

        const newNodeId = paste(clipboardNode, parentId);

        // Clear flag and commit to history
        useMindMapStore.setState((state: any) => {
          state._pasteInProgress = false;
        });

        // Trigger single history snapshot for entire paste operation
        const state = useMindMapStore.getState();
        if (typeof (state as any).commitSnapshot === 'function') {
          (state as any).commitSnapshot();
        }

        if (newNodeId) {
          selectNode(newNodeId);
          showNotification('success', `「${clipboardNode.text}」を貼り付けました`);
        } else {
          console.error('pasteNode: failed to create new node');
        }
      } catch (error) {
        console.error('pasteNode: error accessing store', error);
        showNotification('error', 'ペースト中にエラーが発生しました');
        // Clear flag on error
        useMindMapStore.setState((state: any) => {
          state._pasteInProgress = false;
        });
      }
    },
    pasteImageFromClipboard,
    findNodeById: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      return findNodeInRoots(roots, nodeId);
    },
    closeAttachmentAndLinkLists: () => store.closeAttachmentAndLinkLists?.(),
    // Markdown panel visibility control for commands
    showNotesPanel: !!useMindMapStore.getState().ui?.showNotesPanel,
    setShowNotesPanel: (show: boolean) => store.setShowNotesPanel?.(show),
    toggleNotesPanel: () => store.toggleNotesPanel?.(),
    // Node note panel visibility control for commands
    showNodeNotePanel: !!useMindMapStore.getState().ui?.showNodeNotePanel,
    setShowNodeNotePanel: (show: boolean) => store.setShowNodeNotePanel?.(show),
    toggleNodeNotePanel: () => store.toggleNodeNotePanel?.(),
    onMarkdownNodeType: changeNodeType,
    changeSiblingOrder,
    centerNodeInView,
    // Map switching helpers for global shortcuts (Ctrl+P/N)
    switchToPrevMap: () => {
      try {
        const order = (window as any).mindoodleOrderedMaps as Array<{ mapId: string; workspaceId: string }> || [];
        const maps = (window as any).mindoodleAllMaps || [];
        const currentId: string | null = (window as any).mindoodleCurrentMapId || null;
        if (!Array.isArray(order) || order.length === 0) return;

        const isEmpty = (m: any): boolean => {
          try {
            const roots = m?.rootNodes || [];
            if (!Array.isArray(roots) || roots.length === 0) return true;
            const onlyRoot = roots.length === 1 && (!roots[0].children || roots[0].children.length === 0);
            return onlyRoot;
          } catch { return false; }
        };

        let idx = order.findIndex((o: any) => o?.mapId === currentId);
        if (idx < 0) idx = 0;
        for (let step = 0; step < order.length; step++) {
          idx = idx <= 0 ? order.length - 1 : idx - 1;
          const cand = order[idx];
          const mapData = maps.find((m: any) => m?.mapIdentifier?.mapId === cand.mapId);
          // If we don't have map data loaded, assume non-empty to allow navigation
          if (!mapData || !isEmpty(mapData)) {
            const ev = new CustomEvent('mindoodle:selectMapById', { detail: { mapId: cand.mapId, workspaceId: cand.workspaceId, source: 'keyboard', direction: 'prev' } });
            window.dispatchEvent(ev);
            break;
          }
        }
      } catch {}
    },
    switchToNextMap: () => {
      try {
        const order = (window as any).mindoodleOrderedMaps as Array<{ mapId: string; workspaceId: string }> || [];
        const maps = (window as any).mindoodleAllMaps || [];
        const currentId: string | null = (window as any).mindoodleCurrentMapId || null;
        if (!Array.isArray(order) || order.length === 0) return;

        const isEmpty = (m: any): boolean => {
          try {
            const roots = m?.rootNodes || [];
            if (!Array.isArray(roots) || roots.length === 0) return true;
            const onlyRoot = roots.length === 1 && (!roots[0].children || roots[0].children.length === 0);
            return onlyRoot;
          } catch { return false; }
        };

        let idx = order.findIndex((o: any) => o?.mapId === currentId);
        if (idx < 0) idx = 0;
        for (let step = 0; step < order.length; step++) {
          idx = idx >= order.length - 1 ? 0 : idx + 1;
          const cand = order[idx];
          const mapData = maps.find((m: any) => m?.mapIdentifier?.mapId === cand.mapId);
          if (!mapData || !isEmpty(mapData)) {
            const ev = new CustomEvent('mindoodle:selectMapById', { detail: { mapId: cand.mapId, workspaceId: cand.workspaceId, source: 'keyboard', direction: 'next' } });
            window.dispatchEvent(ev);
            break;
          }
        }
      } catch {}
    },

    // Node structure manipulation
    moveNode: async (nodeId: string, newParentId: string) => {
      const result = store.moveNode(nodeId, newParentId);
      if (result.success) {
        showNotification('success', 'ノードを移動しました');
      } else {
        showNotification('warning', result.reason || 'ノードの移動ができませんでした');
        logger.warn('moveNode constraint violation:', result.reason);
      }
    },
    moveNodeWithPosition: async (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => {
      const result = store.moveNodeWithPosition(nodeId, targetNodeId, position);
      if (result.success) {
        showNotification('success', 'ノードを移動しました');
      } else {
        showNotification('warning', result.reason || 'ノードの移動ができませんでした');
        logger.warn('moveNodeWithPosition constraint violation:', result.reason);
      }
    },
    findParentNode: (nodeId: string) => {
      const roots = useMindMapStore.getState().data?.rootNodes || (data?.rootNode ? [data.rootNode] : []);
      for (const root of roots) {
        const parent = findParentNode(root, nodeId);
        if (parent) return parent;
      }
      return null;
    },
  }), [
    data, ui, store, logger, showNotification,
    centerNodeInView,
    selectedNodeId, editingNodeId, editText,
    startEditing, startEditingWithCursorAtEnd, startEditingWithCursorAtStart,
    finishEditing, updateNode, deleteNode,
    undo, redo, canUndo, canRedo, selectNode, setPan, applyAutoLayout,
    pasteImageFromClipboard, pasteNodeFromClipboard, changeNodeType, changeSiblingOrder,
  ]);
}
