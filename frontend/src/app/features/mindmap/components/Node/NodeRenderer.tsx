import React, { memo, useState, useEffect } from 'react';
import { useMindMapStore } from '../../store';
import type { MindMapNode } from '@shared/types';
import {
  getBaseNodeStyles,
  getSelectionBorderStyles,
  getBackgroundFill,
  DEFAULT_ANIMATION_CONFIG
} from '../../handlers';

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
  onLoadRelativeImage
}) => {
  const { settings } = useMindMapStore();

  // State to hold resolved data URLs for relative local images
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});

  // Extract image URLs from node note
  const extractNoteImages = (note?: string): string[] => {
    if (!note) return [];
    const urls: string[] = [];
    // Combined regex that preserves source order for Markdown and HTML images
    const re = /!\[[^\]]*\]\(\s*([^\s)]+)(?:\s+[^)]*)?\)|<img[^>]*\ssrc=["']([^"'>\s]+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      const url = m[1] || m[2];
      if (url) urls.push(url);
    }
    return urls;
  };

  // Check if a path is a relative local file path
  const isRelativeLocalPath = (path: string): boolean => {
    if (/^(https?:|data:|blob:)/i.test(path)) return false;
    return path.startsWith('./') || path.startsWith('../') || (!path.includes('://') && !path.startsWith('/'));
  };

  const noteImageUrls = extractNoteImages(node.note);

  // Effect to load relative local images using the adapter
  useEffect(() => {
    const loadRelativeImages = async () => {
      if (!onLoadRelativeImage || noteImageUrls.length === 0) {
        return;
      }

      const newResolvedUrls: Record<string, string> = {};

      for (const imageUrl of noteImageUrls) {
        if (isRelativeLocalPath(imageUrl) && !resolvedImageUrls[imageUrl]) {
          try {
            const dataUrl = await onLoadRelativeImage(imageUrl);
            if (dataUrl) {
              newResolvedUrls[imageUrl] = dataUrl;
            }
          } catch (error) {
            console.warn('Failed to load relative image:', imageUrl, error);
          }
        }
      }

      if (Object.keys(newResolvedUrls).length > 0) {
        setResolvedImageUrls(prev => ({ ...prev, ...newResolvedUrls }));
      }
    };

    loadRelativeImages();
  }, [noteImageUrls.join(','), onLoadRelativeImage]);

  // Use shared rendering utilities
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

  // Calculate image display parameters
  const getImageDisplayUrl = (originalUrl: string): string | null => {
    if (isRelativeLocalPath(originalUrl)) {
      return resolvedImageUrls[originalUrl] || null;
    }
    return originalUrl;
  };

  // Determine if node has images and calculate layout
  const hasImages = noteImageUrls.length > 0;
  const displayImageUrl = hasImages ? getImageDisplayUrl(noteImageUrls[0]) : null;

  // Calculate image size (use custom size if available, otherwise default)
  const getImageSize = () => {
    if (node.customImageWidth && node.customImageHeight) {
      return { width: node.customImageWidth, height: node.customImageHeight };
    }
    return { width: 150, height: imageHeight || 105 };
  };

  const imageSize = getImageSize();

  return (
    <>
      {/* Node background */}
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

      {/* Image display */}
      {hasImages && displayImageUrl && (
        <image
          href={displayImageUrl}
          x={node.x - imageSize.width / 2}
          y={node.y - nodeHeight / 2 + 8}
          width={imageSize.width}
          height={imageSize.height}
          preserveAspectRatio="xMidYMid meet"
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />
      )}
    </>
  );
};

// 選択枠線のみを描画する新しいコンポーネント
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

  // Use shared selection border styles
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
      style={borderStyles.style}
    />
  );
};

export default memo(NodeRenderer);
