import React from 'react';
import type { FileAttachment } from '@shared/types';

interface ImageNodeContentProps {
  image: FileAttachment;
  resolvedUrl?: string;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onLoad: (width: number, height: number) => void;
}

const LoadingPlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    color: '#6b7280',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif'
  }}>
    {message}
  </div>
);

const createErrorDiv = (name: string) => {
  const div = document.createElement('div');
  div.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fef2f2;
    color: #dc2626;
    fontSize: 12px;
    fontFamily: system-ui, sans-serif;
    text-align: center;
    padding: 8px;
  `;
  div.textContent = `画像の読み込みに失敗しました\n${name}`;
  return div;
};

export const ImageNodeContent: React.FC<ImageNodeContentProps> = ({
  image,
  resolvedUrl,
  onClick,
  onDoubleClick,
  onContextMenu,
  onLoad
}) => {
  const relativeFile = image as FileAttachment & { isRelativeLocal?: boolean };

  const imageSrc = relativeFile.isRelativeLocal && relativeFile.downloadUrl
    ? resolvedUrl || ''
    : image.dataURL || image.downloadUrl || image.data || '';

  if (relativeFile.isRelativeLocal && !imageSrc) {
    return <LoadingPlaceholder message="画像を読み込み中..." />;
  }

  if (!imageSrc) {
    return <LoadingPlaceholder message="画像を読み込めません" />;
  }

  return (
    <img
      src={imageSrc}
      alt={image.name || '画像'}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        display: 'block',
        margin: '0 auto'
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onError={(e) => {
        console.warn('[ImageNodeContent] 画像の読み込みに失敗:', {
          name: image.name,
          src: imageSrc,
          isRelative: relativeFile.isRelativeLocal
        });
        const img = e.currentTarget;
        img.style.display = 'none';
        const parent = img.parentElement;
        if (parent) {
          parent.appendChild(createErrorDiv(image.name));
        }
      }}
      onLoad={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (w > 0 && h > 0) onLoad(w, h);
      }}
    />
  );
};
