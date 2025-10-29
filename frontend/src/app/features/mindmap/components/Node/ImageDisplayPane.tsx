import React from 'react';
import type { FileAttachment } from '@shared/types';
import { PaginationControl } from './PaginationControl';
import { ImageNodeContent } from './ImageNodeContent';
import { ResizeHandle } from './ResizeHandle';

interface Props {
  currentImage?: FileAttachment;
  resolvedUrl?: string;
  imageWidth: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (e: React.MouseEvent, file: FileAttachment) => void;
  onDoubleClick: (e: React.MouseEvent, file: FileAttachment) => void;
  onContextMenu: (e: React.MouseEvent | { stopPropagation: () => void; preventDefault: () => void; clientX: number; clientY: number }, file: FileAttachment) => void;
  onLoad: (w: number, h: number) => void;
  isResizing: boolean;
  onResizePointerDown: (e: React.PointerEvent) => void;
  slotIndex: number;
  totalCount: number;
}

const ImageDisplayPane: React.FC<Props> = ({
  currentImage,
  resolvedUrl,
  imageWidth,
  isSelected,
  isHovered,
  onClick,
  onDoubleClick,
  onContextMenu,
  onLoad,
  isResizing,
  onResizePointerDown,
  slotIndex,
  totalCount,
}) => {
  return (
    <div
      style={{
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
    >
      {currentImage && (
        <ImageNodeContent
          image={currentImage}
          resolvedUrl={resolvedUrl}
          onClick={(e) => onClick(e, currentImage)}
          onDoubleClick={(e) => onDoubleClick(e, currentImage)}
          onContextMenu={(e) => onContextMenu(e, currentImage)}
          onLoad={onLoad}
        />
      )}

      {totalCount > 1 && (isSelected || isHovered) && (
        <PaginationControl
          currentIndex={slotIndex}
          totalCount={totalCount}
          width={imageWidth}
          onPrevious={() => { /* noop handled by parent via slotIndex setter */ }}
          onNext={() => { /* noop handled by parent via slotIndex setter */ }}
        />
      )}

      {isSelected && <ResizeHandle isResizing={isResizing} onPointerDown={onResizePointerDown} />}
    </div>
  );
};

export default ImageDisplayPane;

