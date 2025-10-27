import React from 'react';

interface ResizeHandleProps {
  isResizing: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ isResizing, onPointerDown }) => (
  <div
    onPointerDown={onPointerDown}
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
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    }}
  />
);
