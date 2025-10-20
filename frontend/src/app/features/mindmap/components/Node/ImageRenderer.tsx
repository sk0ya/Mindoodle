import React, { memo } from 'react';
import type { FileAttachment } from '@shared/types';

interface ImageRendererProps {
  imageSrc: string;
  renderDims: { width: number; height: number };
  isSelected: boolean;
  isResizing: boolean;
  isHovered: boolean;
  displayEntriesCount: number;
  slotIndex: number;
  onImageLoad: (img: HTMLImageElement) => void;
  onImageError: () => void;
  onImageClick: (e: React.MouseEvent, file: FileAttachment) => void;
  onImageDoubleClick: (e: React.MouseEvent, file: FileAttachment) => void;
  onFileActionMenu: (e: React.MouseEvent, file: FileAttachment) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  onSlotPrev: () => void;
  onSlotNext: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  file: FileAttachment;
  nodeId: string;
}

export const ImageRenderer: React.FC<ImageRendererProps> = memo(({
  imageSrc,
  renderDims,
  isSelected,
  isResizing,
  isHovered,
  displayEntriesCount,
  slotIndex,
  onImageLoad,
  onImageError,
  onImageClick,
  onImageDoubleClick,
  onFileActionMenu,
  onResizePointerDown,
  onSlotPrev,
  onSlotNext,
  onMouseEnter,
  onMouseLeave,
  file
}) => {
  const tiny = renderDims.width < 100;
  const compact = renderDims.width < 140;
  let fontSize = 12;
  if (tiny) fontSize = 9; else if (compact) fontSize = 10;
  let padH = '2px 6px';
  if (tiny) padH = '0 3px'; else if (compact) padH = '1px 4px';
  const btnPad = tiny ? '0 3px' : '0 4px';

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img
        src={imageSrc}
        alt={file.name}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '8px',
          pointerEvents: 'auto',
          userSelect: 'none'
        }}
        draggable={false}
        onLoad={(e) => onImageLoad(e.currentTarget)}
        onError={onImageError}
        onClick={(e) => onImageClick(e, file)}
        onDoubleClick={(e) => onImageDoubleClick(e, file)}
        onContextMenu={(e) => onFileActionMenu(e, file)}
      />

      {/* Image carousel controls */}
      {displayEntriesCount > 1 && (isSelected || isHovered) && (
        <div
          style={{
            position: 'absolute',
            left: 6,
            bottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: tiny ? 2 : 4,
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            borderRadius: 9999,
            padding: padH,
            pointerEvents: 'auto',
            lineHeight: 1
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onSlotPrev(); }}
            style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
            aria-label="前の画像"
            title="前の画像"
          >
            ‹
          </button>
          <div style={{ fontSize: fontSize - 1 }}>{slotIndex + 1}/{displayEntriesCount}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onSlotNext(); }}
            style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
            aria-label="次の画像"
            title="次の画像"
          >
            ›
          </button>
        </div>
      )}

      {/* Resize handle */}
      {isSelected && (
        <div
          onPointerDown={onResizePointerDown}
          title="サイズ変更"
          style={{
            position: 'absolute',
            right: 2,
            bottom: 2,
            width: 12,
            height: 12,
            background: 'white',
            border: '1px solid #bfdbfe',
            borderRadius: 2,
            cursor: isResizing ? 'nw-resize' : 'se-resize',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            pointerEvents: 'auto'
          }}
        />
      )}
    </div>
  );
});

ImageRenderer.displayName = 'ImageRenderer';
