import React, { useRef, memo, useCallback } from 'react';
import CanvasRenderer from '../core/CanvasRenderer';
import { useCanvasDragHandler } from '../core/CanvasDragHandler';
import { useCanvasViewportHandler } from '../core/CanvasViewportHandler';
import { useCanvasEventHandler } from '../core/CanvasEventHandler';
import type { MindMapData, MindMapNode, NodeLink } from '@shared/types';

interface MindMapCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onNavigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onAddLink: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  // Link display data
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
  
  // Link navigation
  onLinkNavigate?: (link: NodeLink) => void;
  
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  
  // Icon toggle handlers
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = (props) => {
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setEditText,
    onSelectNode,
    onStartEdit,
    onFinishEdit,
    onChangeParent,
    onChangeSiblingOrder,
    onAddChild,
    onAddSibling,
    onDeleteNode,
    onRightClick,
    onToggleCollapse,
    onShowLinkActionMenu,
    onUpdateNode,
    onAutoLayout,
    availableMaps,
    currentMapData,
    onLinkNavigate,
    zoom,
    setZoom,
    pan,
    setPan,
    onToggleAttachmentList,
    onToggleLinkList,
    onLoadRelativeImage
  } = props;

  const svgRef = useRef<SVGSVGElement>(null);
  
  // ノードの平坦化
  const flattenVisibleNodes = (node: MindMapNode): MindMapNode[] => {
    const result: MindMapNode[] = [];
    // 全てのノードを表示対象とする（複数ルートノード対応）
    result.push(node);

    if (!node?.collapsed && node?.children) {
      node.children.forEach((child: MindMapNode) => {
        result.push(...flattenVisibleNodes(child));
      });
    }
    return result;
  };
  
  // Only use rootNodes array - no fallback to single rootNode
  const rootNodes = data.rootNodes || [];

  // Flatten all nodes from all root nodes
  const allNodes = rootNodes.flatMap(rootNode => flattenVisibleNodes(rootNode));
  
  // ドラッグハンドラーを使用 - only use rootNodes
  const { dragState, handleDragStart, handleDragMove, handleDragEnd } = useCanvasDragHandler({
    allNodes,
    zoom,
    pan,
    svgRef,
    onChangeParent,
    onChangeSiblingOrder,
    rootNodes
  });

  // ビューポートハンドラーを使用
  const { handleWheel, handleMouseDown, getCursor, getIsPanning } = useCanvasViewportHandler({
    zoom,
    setZoom,
    pan,
    setPan,
    svgRef,
    isDragging: dragState.isDragging
  });

  // イベントハンドラーを使用
  const { handleMouseUp: handleCanvasMouseUp, handleContextMenu, handleNodeSelect, handleMouseDown: handleCanvasMouseDown } = useCanvasEventHandler({
    editingNodeId,
    editText,
    onSelectNode,
    onFinishEdit,
    getIsPanning
  });

  // ドラッグハンドラーのアダプター（Node.tsxとの互換性維持）
  const handleDragStartAdapter = (nodeId: string) => {
    handleDragStart(nodeId, {} as React.MouseEvent);
  };

  const handleDragMoveAdapter = (x: number, y: number) => {
    const mockEvent = { clientX: x, clientY: y } as React.MouseEvent;
    handleDragMove(mockEvent);
  };

  const handleDragEndAdapter = (_nodeId: string, _x: number, _y: number) => {
    handleDragEnd();
  };

  // マウスダウンイベントを組み合わせる
  const combinedHandleMouseDown = useCallback((e: React.MouseEvent) => {
    handleCanvasMouseDown(e);
    handleMouseDown(e);
    // Ensure focus moves to SVG so app-level shortcuts receive key events
    try { svgRef.current?.focus?.(); } catch (_) {}
  }, [handleCanvasMouseDown, handleMouseDown]);

  return (
    <CanvasRenderer
      svgRef={svgRef}
      data={data}
      allNodes={allNodes}
      selectedNodeId={selectedNodeId}
      editingNodeId={editingNodeId}
      editText={editText}
      setEditText={setEditText}
      zoom={zoom}
      pan={pan}
      cursor={getCursor()}
      dragState={dragState}
      onWheel={handleWheel}
      onMouseDown={combinedHandleMouseDown}
      onMouseUp={handleCanvasMouseUp}
      onContextMenu={handleContextMenu}
      onNodeSelect={handleNodeSelect}
      onStartEdit={onStartEdit}
      onFinishEdit={onFinishEdit}
      onAddChild={onAddChild}
      onAddSibling={onAddSibling}
      onDeleteNode={onDeleteNode}
      onRightClick={onRightClick}
      onToggleCollapse={onToggleCollapse}
      onShowLinkActionMenu={onShowLinkActionMenu}
      onUpdateNode={onUpdateNode}
      onAutoLayout={onAutoLayout}
      availableMaps={availableMaps}
      currentMapData={currentMapData}
      onLinkNavigate={onLinkNavigate}
      onDragStart={handleDragStartAdapter}
      onDragMove={handleDragMoveAdapter}
      onDragEnd={handleDragEndAdapter}
      onToggleAttachmentList={onToggleAttachmentList}
      onToggleLinkList={onToggleLinkList}
      onLoadRelativeImage={onLoadRelativeImage}
    />
  );
};

export default memo(MindMapCanvas);
