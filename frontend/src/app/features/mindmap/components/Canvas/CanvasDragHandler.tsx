import React, { useCallback, useState } from 'react';
import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { dispatchCanvasEvent } from '@mindmap/events/dispatcher';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dropAction: 'move-parent' | 'reorder-sibling' | null;
  dragOffset: { x: number; y: number };
}

interface CanvasDragHandlerProps {
  allNodes: MindMapNode[];
  zoom: number;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement>;
  // Callbacks are deprecated in favor of strategy dispatch; kept optional for compatibility
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onMoveNodeWithPosition?: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => void;
  rootNodes: MindMapNode[];
}

export const useCanvasDragHandler = ({
  allNodes,
  zoom,
  pan,
  svgRef,
  // Deprecated callbacks (not used): onChangeParent, onChangeSiblingOrder, onMoveNodeWithPosition,
  rootNodes
}: CanvasDragHandlerProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    dropTargetId: null,
    dropPosition: null,
    dropAction: null,
    dragOffset: { x: 0, y: 0 }
  });

  // ドロップターゲットとアクションを判定するヘルパー関数
  const getDropTargetAndAction = useCallback((x: number, y: number, shiftKey?: boolean): { node: MindMapNode | null; position: 'child' | 'before' | 'after' | null; action: 'move-parent' | 'reorder-sibling' | null } => {
    // SVG座標系での位置を取得
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return { node: null, position: null, action: null };

    // マウス座標をSVG内座標に変換（zoom, panを考慮）
    const svgX = (x - svgRect.left) / (zoom * 1.5) - pan.x;
    const svgY = (y - svgRect.top) / (zoom * 1.5) - pan.y;


    // 各ノードとの距離を計算して最も近いものを見つける
    let closestNode: MindMapNode | null = null;
    let minDistance = Infinity;
    const maxDropDistance = 100; // ドロップ可能な最大距離

    allNodes.forEach(node => {
      if (node.id === dragState.draggedNodeId) return; // 自分自身は除外

      const distance = Math.sqrt(
        Math.pow(node.x - svgX, 2) + Math.pow(node.y - svgY, 2)
      );

      if (distance < maxDropDistance && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    if (!closestNode) {
      return { node: null, position: null, action: null };
    }

    // 型アサーション（nullチェック後なのでclosestNodeは非null）
    const targetNode: MindMapNode = closestNode;

    // 位置による判定を優先するため、親子関係の検索は不要
    // const findParent = (childId: string): MindMapNode | null => {
    //   const findParentRecursive = (node: MindMapNode): MindMapNode | null => {
    //     if (node.children) {
    //       for (const child of node.children) {
    //         if (child.id === childId) return node;
    //         const found = findParentRecursive(child);
    //         if (found) return found;
    //       }
    //     }
    //     return null;
    //   };
    //   for (const root of rootNodes) {
    //     const found = findParentRecursive(root);
    //     if (found) return found;
    //   }
    //   return null;
    // };

    // 位置による判定を優先するため、親子関係の取得は不要
    // const draggedParent = dragState.draggedNodeId ? findParent(dragState.draggedNodeId) : null;
    // const targetParent = findParent(targetNode.id);

    // ノード内での相対位置を計算（ノードの高さを40pxと仮定）
    const nodeHeight = 40;
    const relativeY = svgY - targetNode.y;
    const topThreshold = -nodeHeight / 2;    // 上部1/2に拡大
    const bottomThreshold = nodeHeight / 2;  // 下部1/2に拡大

    let position: 'child' | 'before' | 'after' | null = null;
    let action: 'move-parent' | 'reorder-sibling' | null = null;

    if (shiftKey) {
      // Shiftキーが押されている場合は強制的に親変更
      position = 'child';
      action = 'move-parent';
    } else {
      // 位置による判定を優先（親子関係に関係なく）
      if (relativeY < topThreshold) {
        position = 'before';
        action = 'reorder-sibling';
      } else if (relativeY > bottomThreshold) {
        position = 'after';
        action = 'reorder-sibling';
      } else {
        position = 'child';
        action = 'move-parent';
      }
    }


    return { node: targetNode, position, action };
  }, [allNodes, zoom, pan, dragState.draggedNodeId, svgRef, rootNodes]);

  // ドラッグ開始時の処理
  const handleDragStart = useCallback((nodeId: string, _e: React.MouseEvent | React.TouchEvent) => {
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      dropTargetId: null,
      dropPosition: null,
      dropAction: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, []);

  // ドラッグ中の処理（スロットリング付き）
  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    const shiftKey = 'shiftKey' in e ? e.shiftKey : false;

    setDragState(prev => {
      if (!prev.isDragging) {
        return prev;
      }

      const { node: targetNode, position, action } = getDropTargetAndAction(clientX, clientY, shiftKey);

      // 状態が変わった場合のみ更新
      if (prev.dropTargetId !== (targetNode?.id || null) ||
        prev.dropPosition !== position ||
        prev.dropAction !== action) {
        return {
          ...prev,
          dropTargetId: targetNode?.id || null,
          dropPosition: position,
          dropAction: action
        };
      }

      return prev;
    });
  }, [getDropTargetAndAction]);

  // ドラッグ終了時の処理
  const handleDragEnd = useCallback(() => {
    setDragState(prevState => {

      if (prevState.dropTargetId &&
        prevState.dropTargetId !== prevState.draggedNodeId &&
        prevState.draggedNodeId &&
        prevState.dropAction) {
        try {
          dispatchCanvasEvent({
            type: 'nodeDragEnd',
            x: 0,
            y: 0,
            targetNodeId: prevState.dropTargetId,
            draggedNodeId: prevState.draggedNodeId,
            dropPosition: prevState.dropPosition || null
          });
        } catch { /* ignore */ }

        if (prevState.dropAction === 'reorder-sibling') {
          // 位置指定付き親変更を使用（before/after/child対応）
          logger.debug('位置指定付き移動実行:', {
            draggedNodeId: prevState.draggedNodeId,
            targetNodeId: prevState.dropTargetId,
            position: prevState.dropPosition
          });

          // Movement is handled via strategy dispatch (nodeDragEnd)
        } else if (prevState.dropAction === 'move-parent') {
          // 親変更
          logger.debug('親変更実行:', {
            draggedNodeId: prevState.draggedNodeId,
            newParentId: prevState.dropTargetId
          });
          // Parent movement is handled via strategy dispatch (nodeDragEnd)
        }
      }

      return {
        isDragging: false,
        draggedNodeId: null,
        dropTargetId: null,
        dropPosition: null,
        dropAction: null,
        dragOffset: { x: 0, y: 0 }
      };
    });
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  };
};
