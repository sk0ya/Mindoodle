import { useMemo } from 'react';
import { findNodeById, getSiblingNodes, getFirstVisibleChild } from '../../../../shared/utils/nodeTreeUtils';
import { findNodeBySpatialDirection } from '../../../../shared/utils/navigation';
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
      if (text !== undefined) finishEditing(nodeId, text);
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
      if (!selectedNodeId || !data?.rootNode) return;
      const currentNode = findNodeById(data.rootNode, selectedNodeId);
      if (!currentNode) return;
      let nextNodeId: string | null = null;
      switch (direction) {
        case 'left': {
          // Move to parent node
          const stack: MindMapNode[] = [data.rootNode];
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
          const { siblings, currentIndex } = getSiblingNodes(data.rootNode, selectedNodeId);
          if (siblings.length > 1 && currentIndex !== -1) {
            let targetIndex = -1;
            if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
            else if (direction === 'down' && currentIndex < siblings.length - 1) targetIndex = currentIndex + 1;
            if (targetIndex !== -1) nextNodeId = siblings[targetIndex].id;
          }
          break;
        }
      }
      if (!nextNodeId) nextNodeId = findNodeBySpatialDirection(selectedNodeId, direction, data.rootNode);
      if (nextNodeId) {
        selectNode(nextNodeId);
        // Ensure the newly selected node is visible (but don't center it)
        ensureNodeVisible(nextNodeId);
      }

      // Helper function to ensure node is visible without centering
      function ensureNodeVisible(nodeId: string) {
        const node = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
        if (!node || !setPan) return;

        // Get actual viewport dimensions considering sidebar and panels
        const mindmapContainer = document.querySelector('.mindmap-workspace') ||
                                document.querySelector('.mindmap-canvas') ||
                                document.querySelector('.canvas-container');

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
          // Fallback: manually calculate effective area considering all panels

          // Left sidebar
          const sidebar = document.querySelector('.sidebar') ||
                         document.querySelector('.primary-sidebar') ||
                         document.querySelector('.primary-sidebar-container');
          if (sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();
            effectiveWidth -= sidebarRect.width;
            offsetX = sidebarRect.width;
          }

          // Right panels (notes panel, customization panel, etc.)
          const rightPanels = [
            document.querySelector('.node-notes-panel'),
            document.querySelector('.customization-panel'),
            document.querySelector('.notes-panel-container'),
            document.querySelector('.panel-container')
          ].filter(panel => {
            if (!panel) return false;
            const rect = panel.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0; // Only visible panels
          });

          rightPanels.forEach(panel => {
            if (panel) {
              const panelRect = panel.getBoundingClientRect();
              effectiveWidth -= panelRect.width;
            }
          });

          // Top toolbar/header
          const header = document.querySelector('.toolbar') ||
                        document.querySelector('.mindmap-header') ||
                        document.querySelector('.header');
          if (header) {
            const headerRect = header.getBoundingClientRect();
            effectiveHeight -= headerRect.height;
            offsetY = headerRect.height;
          }
        }

        const currentZoom = ui.zoom * 1.5; // Match the transform scale from CanvasRenderer
        const currentPan = ui.pan;

        // Calculate node's screen position relative to the effective viewport
        const nodeScreenX = currentZoom * (node.x + currentPan.x) - offsetX;
        const nodeScreenY = currentZoom * (node.y + currentPan.y) - offsetY;

        // Define margins to keep node away from edges
        const margin = 100;

        // Check if node is outside effective viewport bounds
        const isOutsideLeft = nodeScreenX < margin;
        const isOutsideRight = nodeScreenX > effectiveWidth - margin;
        const isOutsideTop = nodeScreenY < margin;
        const isOutsideBottom = nodeScreenY > effectiveHeight - margin;

        if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
          // Calculate minimal pan adjustment needed
          let newPanX = currentPan.x;
          let newPanY = currentPan.y;

          if (isOutsideLeft) {
            newPanX = (margin + offsetX - currentZoom * node.x) / currentZoom;
          } else if (isOutsideRight) {
            newPanX = (effectiveWidth - margin + offsetX - currentZoom * node.x) / currentZoom;
          }

          if (isOutsideTop) {
            newPanY = (margin + offsetY - currentZoom * node.y) / currentZoom;
          } else if (isOutsideBottom) {
            newPanY = (effectiveHeight - margin + offsetY - currentZoom * node.y) / currentZoom;
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
      const node = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
      if (!node) return;
      store.setClipboard(node);
      const convertToMd = (n: MindMapNode, level = 0): string => {
        const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
        let md = `${prefix}${n.text}\n`;
        if (n.note?.trim()) md += `${n.note}\n`;
        if (n.children?.length) n.children.forEach(c => { md += convertToMd(c, level + 1); });
        return md;
      };
      const markdownText = convertToMd(node);
      navigator.clipboard?.writeText?.(markdownText).catch(() => {});
      showNotification('success', `「${node.text}」をコピーしました`);
    },
    pasteNode: async (parentId: string) => {
      // try image first, then fallback to structured paste
      try {
        await pasteImageFromClipboard(parentId);
        return;
      } catch {}
      await pasteNodeFromClipboard(parentId);
    },
    pasteImageFromClipboard,
    findNodeById: (nodeId: string) => data?.rootNode ? findNodeById(data.rootNode, nodeId) : null,
    closeAttachmentAndLinkLists: () => store.closeAttachmentAndLinkLists?.(),
    onMarkdownNodeType: changeNodeType,
    changeSiblingOrder,
    centerNodeInView,
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
