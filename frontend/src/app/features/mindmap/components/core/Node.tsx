import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import NodeRenderer, { NodeSelectionBorder } from './NodeRenderer';
import NodeEditor from './NodeEditor';
import NodeAttachments from './NodeAttachments';
import { useNodeDragHandler } from './NodeDragHandler';
import { calculateNodeSize, getNodeLeftX } from '../../../../shared/utils/nodeUtils';
import type { MindMapNode, FileAttachment, NodeLink } from '@shared/types';
import { useMindMapStore } from '../../../../core/store/mindMapStore';

interface NodeProps {
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  isDragTarget?: boolean;
  onSelect: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onAddChild?: (nodeId: string) => void;
  onAddSibling?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onDragStart?: (nodeId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (nodeId: string, x: number, y: number) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  editText: string;
  setEditText: (text: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement>;
  globalFontSize?: number;
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  isEditing,
  isDragTarget,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onAddChild: _onAddChild,
  onAddSibling: _onAddSibling,
  onDelete: _onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRightClick,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout,
  editText,
  setEditText,
  zoom,
  pan,
  svgRef,
  globalFontSize,
  onToggleAttachmentList,
  onToggleLinkList
}) => {
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPosition = useRef({ x: node.x, y: node.y });
  
  // ドラッグハンドラーを使用
  const { isDragging, handleMouseDown } = useNodeDragHandler({
    node,
    zoom,
    svgRef,
    onDragStart,
    onDragMove,
    onDragEnd
  });

  // 位置変更を検出してレイアウトトランジション状態を管理
  useEffect(() => {
    const positionChanged = previousPosition.current.x !== node.x || previousPosition.current.y !== node.y;
    if (positionChanged && !isDragging) {
      setIsLayoutTransitioning(true);
      previousPosition.current = { x: node.x, y: node.y };
      
      // 少し遅延してからトランジションを再有効化
      const timeoutId = setTimeout(() => {
        setIsLayoutTransitioning(false);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else {
      previousPosition.current = { x: node.x, y: node.y };
    }
    return undefined;
  }, [node.x, node.y, isDragging]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ドラッグが発生していない場合のみクリック処理
    if (!isDragging) {
      if (isSelected && !isEditing) {
        // 既に選択されている場合は編集モードに入る
        onStartEdit(node.id);
      } else {
        // 未選択の場合は選択のみ
        onSelect(node.id);
      }
    }
  }, [node.id, isDragging, isSelected, isEditing, onStartEdit, onSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStartEdit(node.id);
  }, [node.id, onStartEdit]);

  // Sidebar -> node DnD: add map link on drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Accept map or explorer file drops
    const types = e.dataTransfer.types;
    if (types.includes('text/map-id') || types.includes('mindoodle/path')) {
      e.preventDefault();
      // Indicate a copy drop to match effectAllowed
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!onUpdateNode) return;
    const types = e.dataTransfer.types;
    const isExplorerPath = types.includes('mindoodle/path');
    const isMapId = types.includes('text/map-id');
    if (!isExplorerPath && !isMapId) return;
    e.preventDefault();
    e.stopPropagation();

    const path = isExplorerPath ? e.dataTransfer.getData('mindoodle/path') : '';
    const mapId = isMapId ? e.dataTransfer.getData('text/map-id') : (path.endsWith('.md') ? path.replace(/\.md$/i, '') : '');
    const mapTitle = isMapId
      ? (e.dataTransfer.getData('text/map-title') || mapId.split('/').pop() || 'リンク')
      : (path.split('/').pop() || 'リンク');

    try {
      // Get current map id from store - this is the path of current map file
      const currentData: any = useMindMapStore.getState().data;
      const currentMapId: string = currentData?.mapIdentifier?.mapId || '';

      // Determine target path - both should be file paths
      const targetPath = isExplorerPath ? path : mapId;

      // Calculate relative path between two file paths
      const calculateRelativePath = (from: string, to: string): string => {
        // Remove .md extension if present for path calculation
        const fromPath = from.replace(/\.md$/i, '');
        const toPath = to.replace(/\.md$/i, '');

        // Get directory path for from (current map directory)
        const fromDir = fromPath.includes('/') ? fromPath.split('/').slice(0, -1).join('/') : '';
        // Get directory path for to (target file directory)
        const toDir = toPath.includes('/') ? toPath.split('/').slice(0, -1).join('/') : '';
        // Get filename for to
        const toFile = toPath.split('/').pop() || toPath;

        // If both are in the same directory, just return the filename
        if (fromDir === toDir) {
          return toFile;
        }

        // Split directory paths into segments
        const fromSegments = fromDir ? fromDir.split('/') : [];
        const toDirSegments = toDir ? toDir.split('/') : [];

        // Find common base path
        let commonLength = 0;
        const minLength = Math.min(fromSegments.length, toDirSegments.length);
        for (let i = 0; i < minLength; i++) {
          if (fromSegments[i] === toDirSegments[i]) {
            commonLength = i + 1;
          } else {
            break;
          }
        }

        // Calculate relative path
        const upLevels = fromSegments.length - commonLength;
        const downPath = toDirSegments.slice(commonLength);

        const relativeParts = [];
        for (let i = 0; i < upLevels; i++) {
          relativeParts.push('..');
        }
        relativeParts.push(...downPath);
        relativeParts.push(toFile);

        return relativeParts.join('/');
      };

      let href = calculateRelativePath(currentMapId, targetPath);

      // Add .md extension if target is a markdown file
      if (targetPath.endsWith('.md') || !isExplorerPath) {
        href += '.md';
      }

      // If same file, just use the filename
      if (href === '.md') {
        href = targetPath.split('/').pop() || 'file.md';
      }

      const currentNote = (node as any).note || '';
      const prefix = currentNote.trim().length > 0 ? '\n\n' : '';
      const appended = `${currentNote}${prefix}[${mapTitle}](${href})\n`;
      onUpdateNode(node.id, { note: appended });
      if (onAutoLayout) {
        setTimeout(() => { onAutoLayout(); }, 0);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }, [node.id, onUpdateNode, onAutoLayout]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRightClick) {
      onRightClick(e, node.id);
    }
  }, [node.id, onRightClick]);


  // ノードのサイズ計算（共有ユーティリティ関数を使用、グローバルフォントサイズを適用）
  const nodeSize = calculateNodeSize(node, editText, isEditing, globalFontSize);
  const nodeWidth = nodeSize.width;
  const nodeHeight = nodeSize.height;
  const imageHeight = nodeSize.imageHeight;

  // 非編集時のノード幅を基準とした左端位置を計算（ノードの左端位置を固定するため）
  const baseNodeSize = calculateNodeSize(node, node.text, false, globalFontSize);
  const nodeLeftX = getNodeLeftX(node, baseNodeSize.width);

  return (
    <g>
      {/* 1. ノード背景（最初に描画） */}
      <NodeRenderer
        node={node}
        nodeLeftX={nodeLeftX}
        isSelected={isSelected}
        isDragTarget={isDragTarget}
        isDragging={isDragging}
        isLayoutTransitioning={isLayoutTransitioning}
        nodeWidth={nodeWidth}
        nodeHeight={nodeHeight}
        imageHeight={imageHeight}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

      {/* Removed HTML overlay to avoid blocking clicks; rely on SVG rect handlers */}
      
      {/* 2. 添付ファイル（画像とアイコン） */}
      <NodeAttachments
        node={node}
        svgRef={svgRef}
        zoom={zoom}
        pan={pan}
        isSelected={isSelected}
        onSelectNode={onSelect}
        onShowImageModal={onShowImageModal}
        onShowFileActionMenu={onShowFileActionMenu}
        onUpdateNode={onUpdateNode}
        onAutoLayout={onAutoLayout}
        nodeHeight={nodeHeight}
      />


      {/* 3. テキスト */}
      <NodeEditor
        node={node}
        nodeLeftX={nodeLeftX}
        isEditing={isEditing}
        editText={editText}
        setEditText={setEditText}
        onFinishEdit={onFinishEdit}
        nodeWidth={nodeWidth}
        imageHeight={imageHeight}
        blurTimeoutRef={blurTimeoutRef}
        isSelected={isSelected}
        onSelectNode={onSelect}
        onToggleAttachmentList={onToggleAttachmentList}
        onToggleLinkList={onToggleLinkList}
      />

      {/* 4. 選択枠線（最後に描画して最前面に） */}
      <NodeSelectionBorder
        node={node}
        nodeLeftX={nodeLeftX}
        isSelected={isSelected}
        isDragTarget={isDragTarget}
        isDragging={isDragging}
        isLayoutTransitioning={isLayoutTransitioning}
        nodeWidth={nodeWidth}
        nodeHeight={nodeHeight}
      />
    </g>
  );
};

// React.memoでパフォーマンス最適化
export default memo(Node, (prevProps: NodeProps, nextProps: NodeProps) => {
  // ノードの基本情報が変わった場合は再レンダリング
  if (prevProps.node.id !== nextProps.node.id ||
      prevProps.node.text !== nextProps.node.text ||
      (prevProps.node as any).note !== (nextProps.node as any).note ||
      prevProps.node.x !== nextProps.node.x ||
      prevProps.node.y !== nextProps.node.y ||
      prevProps.node.fontSize !== nextProps.node.fontSize ||
      prevProps.node.fontWeight !== nextProps.node.fontWeight ||
      prevProps.node.color !== nextProps.node.color ||
      prevProps.node.collapsed !== nextProps.node.collapsed ||
      prevProps.node.customImageWidth !== nextProps.node.customImageWidth ||
      prevProps.node.customImageHeight !== nextProps.node.customImageHeight) {
    return false;
  }

  // 添付ファイルが変わった場合は再レンダリング
  if (JSON.stringify(prevProps.node.attachments) !== JSON.stringify(nextProps.node.attachments)) {
    return false;
  }

  // リンクが変わった場合は再レンダリング
  if (JSON.stringify(prevProps.node.links) !== JSON.stringify(nextProps.node.links)) {
    return false;
  }

  // 選択・編集状態が変わった場合は再レンダリング
  if (prevProps.isSelected !== nextProps.isSelected ||
      prevProps.isEditing !== nextProps.isEditing ||
      prevProps.isDragTarget !== nextProps.isDragTarget) {
    return false;
  }

  // 編集テキストが変わった場合は再レンダリング
  if (prevProps.editText !== nextProps.editText) {
    return false;
  }

  // ズーム・パンが変わった場合は再レンダリング
  if (prevProps.zoom !== nextProps.zoom ||
      prevProps.pan.x !== nextProps.pan.x ||
      prevProps.pan.y !== nextProps.pan.y) {
    return false;
  }

  // グローバルフォントサイズが変わった場合は再レンダリング
  if (prevProps.globalFontSize !== nextProps.globalFontSize) {
    return false;
  }

  // その他の場合は再レンダリングしない
  return true;
});

export { Node };
