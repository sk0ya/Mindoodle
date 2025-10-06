import React, { useRef, memo, useCallback, useState } from 'react';
import { CanvasRenderer } from '../Canvas';
import { useCanvasDragHandler } from '../Canvas';
import { useCanvasViewportHandler } from '../Canvas';
import { useCanvasEventHandler } from '../Canvas';
import type { MindMapData, MindMapNode, NodeLink } from '@shared/types';
import { flattenVisibleNodes } from '@mindmap/selectors/mindMapSelectors';
import WebPreviewModal from '../Shared/WebPreviewModal';

interface MindMapCanvasProps {
  data?: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onToggleCollapse: (nodeId: string) => void;
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
  onToggleLinkList?: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
  onImageClick?: (imageUrl: string) => void;
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
    // movement callbacks deprecated (handled by strategies)
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
    onToggleLinkList,
    onLoadRelativeImage,
    onImageClick
  } = props;

  const svgRef = useRef<SVGSVGElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Only use rootNodes array - no fallback to single rootNode
  const rootNodes = data?.rootNodes || [];

  // Flatten all nodes from all root nodes
  const allNodes = rootNodes.flatMap(rootNode => flattenVisibleNodes(rootNode));
  
  // ドラッグハンドラーを使用 - only use rootNodes
  const { dragState, handleDragStart, handleDragMove, handleDragEnd } = useCanvasDragHandler({
    allNodes,
    zoom,
    pan,
    svgRef,
    rootNodes
  });

  // ビューポートハンドラーを使用
  const { handleWheel, handleMouseDown, getCursor, getIsPanning } = useCanvasViewportHandler({
    zoom,
    setZoom,
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
    getIsPanning,
    svgRef
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
    <>
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
        onToggleLinkList={onToggleLinkList}
        onLoadRelativeImage={onLoadRelativeImage}
        onImageClick={onImageClick}
        onPreviewUrl={setPreviewUrl}
      />

      {/* Webページプレビュー */}
      {previewUrl && (
        <WebPreviewModal
          url={previewUrl}
          isOpen={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </>
  );
};

export default memo(MindMapCanvas);
