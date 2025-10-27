import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MermaidRenderer from './MermaidRenderer';
import { useMindMapStore } from '@mindmap/store';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useHoverState } from '@shared/hooks';
import {
  getBaseNodeStyles,
  getSelectionBorderStyles,
  getBackgroundFill,
  DEFAULT_ANIMATION_CONFIG
} from '@mindmap/handlers/BaseRenderer';
import {
  extractDisplayEntries,
  displayEntriesToFileAttachments,
  type DisplayEntry
} from './nodeRendererHelpers';
import { PaginationControl } from './PaginationControl';
import { CheckboxNode } from './CheckboxNode';
import { TableNodeContent } from './TableNodeContent';
import { ImageNodeContent } from './ImageNodeContent';
import { ResizeHandle } from './ResizeHandle';
import { useImageResize } from './useImageResize';
import {
  parseImageDimensions,
  calculateImageDimensions,
  calculateImagePosition,
  getEntryKey
} from './dimensionHelpers';

interface NodeRendererProps {
  node: MindMapNode;
  nodeLeftX: number;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
  imageHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
  
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  onSelectNode?: (nodeId: string | null) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  onToggleCheckbox?: (nodeId: string, checked: boolean) => void;
}

  const NodeRenderer: React.FC<NodeRendererProps> = ({
    node,
    nodeLeftX,
    isSelected,
    isDragTarget,
    isDragging,
    isLayoutTransitioning,
    nodeWidth,
    nodeHeight,
    imageHeight,
    onMouseDown,
    onClick,
    onDoubleClick,
    onContextMenu,
    onDragOver,
  onDrop,
  onLoadRelativeImage,
  
  svgRef,
  zoom,
  pan,
  onSelectNode,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout,
  
  onToggleCheckbox
}) => {
  const { settings, normalizedData } = useMindMapStore();

  
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onToggleCheckbox && node.markdownMeta?.isCheckbox) {

      const normalizedNode = normalizedData?.nodes[node.id];
      const currentChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta?.isChecked ?? false;
      const newChecked = !currentChecked;


      onToggleCheckbox(node.id, newChecked);
    }
  }, [onToggleCheckbox, node.id, node.markdownMeta?.isCheckbox, node.markdownMeta?.isChecked, normalizedData]);

  // Extract display entries from both text and note
  const textEntries = extractDisplayEntries(node.text);
  const noteEntries = extractDisplayEntries(node.note);
  const displayEntries = [...textEntries, ...noteEntries];

  const imageEntries = displayEntries.filter((e): e is Extract<DisplayEntry, { kind: 'image' }> => e.kind === 'image');
  const noteImageFiles = displayEntriesToFileAttachments(imageEntries, node.id);


  
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});

  
  // 画像URLのキーを安定化（無限ループ防止）
  const imageUrlsKey = useMemo(() => {
    return noteImageFiles
      .map(f => (f as FileAttachment & { isRelativeLocal?: boolean }).isRelativeLocal ? f.downloadUrl : '')
      .filter(Boolean)
      .join('|');
  }, [noteImageFiles]);

  useEffect(() => {
    const loadRelativeImages = async () => {
      if (!onLoadRelativeImage) {
        return;
      }

      // 相対パス画像を抽出（resolvedImageUrlsを参照しない）
      const relativeImages: FileAttachment[] = noteImageFiles
        .filter((imageFile): imageFile is FileAttachment => {
          const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
          return Boolean(relativeFile.isRelativeLocal && relativeFile.downloadUrl);
        });

      if (relativeImages.length === 0) {
        return;
      }

      // 並列読み込み
      const loadPromises = relativeImages.map(async (imageFile) => {
        const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
        if (!relativeFile.downloadUrl) return null;

        try {
          const dataUrl = await onLoadRelativeImage(relativeFile.downloadUrl);
          return dataUrl ? { path: relativeFile.downloadUrl, dataUrl } : null;
        } catch (error) {
          console.warn('[NodeRenderer] Failed to load relative image:', relativeFile.downloadUrl, error);
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      const newResolvedUrls: Record<string, string> = {};

      results.forEach(result => {
        if (result && result.dataUrl) {
          newResolvedUrls[result.path] = result.dataUrl;
        }
      });

      if (Object.keys(newResolvedUrls).length > 0) {
        setResolvedImageUrls(newResolvedUrls);
      }
    };

    loadRelativeImages();
  }, [imageUrlsKey, onLoadRelativeImage, noteImageFiles]);

  
  const [slotIndex, setSlotIndex] = useState(0);
  useEffect(() => { setSlotIndex(0); }, [node.id]);
  useEffect(() => {
    const len = displayEntries.length;
    if (len === 0) {
      if (slotIndex !== 0) setSlotIndex(0);
      return;
    }
    if (slotIndex >= len) {
      setSlotIndex(len - 1);
    }
  }, [displayEntries.length, slotIndex]);
  const currentEntry = displayEntries[slotIndex];
  const currentImage: FileAttachment | undefined = currentEntry && currentEntry.kind === 'image'
    ? noteImageFiles[imageEntries.indexOf(currentEntry)]
    : undefined;

  // stable key will be computed after flags are known

  


  const noteSize = currentEntry ? parseImageDimensions(currentEntry, slotIndex) : null;
  const imageDimensions = useMemo(
    () => calculateImageDimensions(node, noteSize, nodeWidth, imageHeight),
    [node.customImageWidth, node.customImageHeight, node.kind, noteSize, nodeWidth, imageHeight, node.id]
  );

  // 決定した画像サイズに基づき、一度だけ自動レイアウトを発火
  const lastLayoutKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onAutoLayout) return;
    if (isResizing) return; // リサイズ中は自動レイアウトを抑止
    const layoutKey = `${node.id}:${imageDimensions.width}x${imageDimensions.height}:${slotIndex}`;
    if (lastLayoutKeyRef.current === layoutKey) return;
    lastLayoutKeyRef.current = layoutKey;
    // レンダリング直後のフレームでレイアウト
    requestAnimationFrame(() => {
      onAutoLayout();
    });
  }, [onAutoLayout, node.id, imageDimensions.width, imageDimensions.height, slotIndex, isResizing]);

  // Use the image resize hook
  const { isResizing, localDims, handleResizePointerDown } = useImageResize({
    node,
    svgRef,
    zoom,
    pan,
    imageDimensions,
    slotIndex,
    displayEntries,
    onUpdateNode,
    onAutoLayout
  });

  const handleImageDoubleClick = useCallback((e: React.MouseEvent, file: FileAttachment & { isImage?: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowImageModal && file.isImage) {
      // For relative local images, include the resolved DataURL
      const relativeFile = file as FileAttachment & { isRelativeLocal?: boolean };
      if (relativeFile.isRelativeLocal && relativeFile.downloadUrl && resolvedImageUrls[relativeFile.downloadUrl]) {
        const fileWithResolvedUrl = {
          ...file,
          dataURL: resolvedImageUrls[relativeFile.downloadUrl]
        };
        onShowImageModal(fileWithResolvedUrl);
      } else {
        onShowImageModal(file);
      }
    }
  }, [onShowImageModal, resolvedImageUrls]);

  // 画像クリック時の処理（ノード選択 or メニュー表示）
  const handleImageClick = useCallback((e: React.MouseEvent, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();

    // ノードが選択されていない場合は選択する
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
      return;
    }

    // 既に選択されている場合はファイルアクションメニューを表示
    if (onShowFileActionMenu) {
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;

      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [isSelected, onSelectNode, onShowFileActionMenu, node.id]);

  const handleFileActionMenu = useCallback((e: React.MouseEvent | { stopPropagation: () => void; preventDefault: () => void; clientX: number; clientY: number }, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowFileActionMenu) {
      // SVGイベントの場合は座標を適切に取得
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;

      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [onShowFileActionMenu, node.id]);

  const renderDims = localDims || imageDimensions;
  const { x: imageX, y: imageY } = calculateImagePosition(node, renderDims, nodeHeight);

  const prevEntryKeyRef = useRef<string>('');
  useEffect(() => {
    type TableNode = MindMapNode & { tableData?: { headers?: string[]; rows?: string[][] } };
    const key = node.kind === 'table' ? `tbl:${(node as TableNode).tableData?.rows?.length || 0}` : getEntryKey(currentEntry);
    if (key !== prevEntryKeyRef.current) {
      prevEntryKeyRef.current = key;
      if (onUpdateNode) {
        onUpdateNode(node.id, { customImageWidth: undefined as unknown as number, customImageHeight: undefined as unknown as number });
      }
    }
  }, [currentEntry, node.id, node.kind, onUpdateNode]);

  // 表示中の画像に合わせてノードの画像サイズを更新
  const handleImageLoadDimensions = useCallback((w: number, h: number) => {
    if (!onUpdateNode) return;
    if (w <= 0 || h <= 0) return;
    // 既にユーザーがカスタム設定済みなら、ロード寸法で上書きしない
    if (node.customImageWidth && node.customImageHeight) return;
    // HTMLのwidth/height属性で指定されている場合も上書きしない
    if (noteSize && noteSize.width > 0 && noteSize.height > 0) return;
    // 初回のみ、表示中の画像に合わせてノードの表示サイズを設定
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, w));
    const ratio = w > 0 ? h / w : 1;
    const newHeight = Math.max(Math.round(newWidth * ratio), Math.round(minWidth * ratio));
    onUpdateNode(node.id, { customImageWidth: Math.round(newWidth), customImageHeight: newHeight });
  }, [node.id, node.customImageWidth, node.customImageHeight, noteSize, onUpdateNode]);

  // ホバー状態でコントロール表示
  const { isHovered, handleMouseEnter, handleMouseLeave } = useHoverState();

  // Use shared rendering utilities for node background
  const renderingState = {
    isSelected,
    isDragTarget: isDragTarget || false,
    isDragging,
    isLayoutTransitioning
  };

  const themeConfig = {
    theme: settings.theme,
    fontSize: settings.fontSize
  };

  const nodeStyles = getBaseNodeStyles(renderingState, themeConfig, DEFAULT_ANIMATION_CONFIG);
  const backgroundFill = getBackgroundFill(themeConfig);

  if (!currentEntry && node.kind !== 'table') {
    const normalizedNode = normalizedData?.nodes[node.id];
    const isCheckboxNode = normalizedNode?.markdownMeta?.isCheckbox ?? node.markdownMeta?.isCheckbox ?? false;
    const isChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta?.isChecked ?? false;

    return (
      <g>
        <rect
          x={nodeLeftX}
          y={node.y - nodeHeight / 2}
          width={nodeWidth}
          height={nodeHeight}
          fill={backgroundFill}
          stroke="transparent"
          strokeWidth="0"
          rx="12"
          ry="12"
          role="button"
          tabIndex={0}
          aria-label={`Mind map node: ${node.text}`}
          aria-selected={isSelected}
          style={nodeStyles}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
        {isCheckboxNode && (
          <CheckboxNode
            nodeLeftX={nodeLeftX}
            nodeY={node.y}
            isChecked={isChecked}
            onClick={handleCheckboxClick}
          />
        )}
      </g>
    );
  }


  const showMermaid = !!currentEntry && (currentEntry).kind === 'mermaid';


  const isTableNode = node.kind === 'table';

  // Stable key for switching between mermaid/table/image/empty without nested ternary
  let contentKey = `empty-${node.id}`;
  if (showMermaid) contentKey = `mermaid-${node.id}`;
  else if (isTableNode) contentKey = `table-${node.id}`;
  else if (currentImage) contentKey = currentImage.id;

  return (
    <>
      {}
      <rect
        x={nodeLeftX}
        y={node.y - nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        fill={backgroundFill}
        stroke="transparent"
        strokeWidth="0"
        rx="12"
        ry="12"
        role="button"
        tabIndex={0}
        aria-label={`Mind map node: ${node.text}`}
        aria-selected={isSelected}
        style={nodeStyles}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />

      {}
      <g key={contentKey}>
          <foreignObject
            x={imageX}
            y={imageY}
            width={renderDims.width}
            height={renderDims.height}
          >
            {showMermaid && (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <MermaidRenderer
                  code={(currentEntry).code}
                  onLoadedDimensions={(w, h) => {
                    
                    handleImageLoadDimensions(w, h);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!isSelected && onSelectNode) onSelectNode(node.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                />
                {displayEntries.length > 1 && (isSelected || isHovered) && (
                  <PaginationControl
                    currentIndex={slotIndex}
                    totalCount={displayEntries.length}
                    width={renderDims.width}
                    onPrevious={() => setSlotIndex((prev) => (prev - 1 + displayEntries.length) % displayEntries.length)}
                    onNext={() => setSlotIndex((prev) => (prev + 1) % displayEntries.length)}
                  />
                )}
                {isSelected && <ResizeHandle isResizing={isResizing} onPointerDown={handleResizePointerDown} />}
              </div>
            )}
            {!showMermaid && isTableNode && (
              <TableNodeContent
                node={node}
                fontSize={settings.fontSize || node.fontSize || 14}
                isSelected={isSelected}
                onSelect={() => onSelectNode?.(node.id)}
                onContextMenu={onContextMenu}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              />
            )}
            {!showMermaid && !isTableNode && (
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '6px',
                overflow: 'hidden',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                cursor: 'pointer'
              }}
              onClick={(e) => currentImage && handleImageClick(e, currentImage)}
              onDoubleClick={(e) => currentImage && handleImageDoubleClick(e, currentImage)}
              onContextMenu={(e) => currentImage && handleFileActionMenu(e, currentImage)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              >
                {currentImage && (
                  <ImageNodeContent
                    image={currentImage}
                    resolvedUrl={(() => {
                      const relativeFile = currentImage as FileAttachment & { isRelativeLocal?: boolean };
                      return relativeFile.isRelativeLocal && relativeFile.downloadUrl
                        ? resolvedImageUrls[relativeFile.downloadUrl]
                        : undefined;
                    })()}
                    onClick={(e) => handleImageClick(e, currentImage)}
                    onDoubleClick={(e) => handleImageDoubleClick(e, currentImage)}
                    onContextMenu={(e) => handleFileActionMenu(e, currentImage)}
                    onLoad={handleImageLoadDimensions}
                  />
                )}

                {displayEntries.length > 1 && (isSelected || isHovered) && (
                  <PaginationControl
                    currentIndex={slotIndex}
                    totalCount={displayEntries.length}
                    width={imageDimensions.width}
                    onPrevious={() => setSlotIndex((prev) => (prev - 1 + displayEntries.length) % displayEntries.length)}
                    onNext={() => setSlotIndex((prev) => (prev + 1) % displayEntries.length)}
                  />
                )}

                {isSelected && <ResizeHandle isResizing={isResizing} onPointerDown={handleResizePointerDown} />}

              </div>
            )}
          </foreignObject>

          {}
          {isSelected && node.kind !== 'table' && (
            <g>
              {}
              <rect
                x={imageX - 2}
                y={imageY - 2}
                width={imageDimensions.width + 4}
                height={imageDimensions.height + 4}
                fill="none"
                stroke="#bfdbfe"
                strokeWidth="1"
                strokeDasharray="5,3"
                rx="6"
                ry="6"
                style={{
                  pointerEvents: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
              />

              {}
            </g>)}
        </g>
    </>
  );
};


export const NodeSelectionBorder: React.FC<{
  node: MindMapNode;
  nodeLeftX: number;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
}> = ({
  node,
  nodeLeftX,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight
}) => {
  if (!isSelected && !isDragTarget) return null;

  
  const renderingState = {
    isSelected,
    isDragTarget: isDragTarget || false,
    isDragging,
    isLayoutTransitioning
  };

  const borderStyles = getSelectionBorderStyles(renderingState, DEFAULT_ANIMATION_CONFIG);

  return (
    <rect
      x={nodeLeftX}
      y={node.y - nodeHeight / 2}
      width={nodeWidth}
      height={nodeHeight}
      fill="transparent"
      stroke={borderStyles.stroke}
      strokeWidth={borderStyles.strokeWidth}
      strokeDasharray={borderStyles.strokeDasharray}
      rx="12"
      ry="12"
      style={{
        ...borderStyles.style,
        transition: 'none' 
      }}
    />
  );
};

export default memo(NodeRenderer, (prevProps, nextProps) => {

  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.text === nextProps.node.text &&
    prevProps.node.note === nextProps.node.note &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.customImageWidth === nextProps.node.customImageWidth &&
    prevProps.node.customImageHeight === nextProps.node.customImageHeight &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.nodeWidth === nextProps.nodeWidth &&
    prevProps.nodeHeight === nextProps.nodeHeight &&
    JSON.stringify(prevProps.node.markdownMeta) === JSON.stringify(nextProps.node.markdownMeta)
  );
});
