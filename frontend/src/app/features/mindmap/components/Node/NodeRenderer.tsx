import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { useMindMapStore } from '@mindmap/store';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useResizingState, useHoverState } from '@shared/hooks';
import {
  getBaseNodeStyles,
  getSelectionBorderStyles,
  getBackgroundFill,
  DEFAULT_ANIMATION_CONFIG
} from '@mindmap/handlers/BaseRenderer';

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
  // Original NodeAttachments props
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  onSelectNode?: (nodeId: string | null) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
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
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDragOver,
  onDrop,
  onLoadRelativeImage,
  // Original NodeAttachments props
  svgRef,
  zoom,
  pan,
  onSelectNode,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout
}) => {
  const { settings } = useMindMapStore();

  // 画像リサイズ状態管理
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

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
  const noteImageFiles: FileAttachment[] = noteImageUrls.map((u, i) => ({
    id: `noteimg-${node.id}-${i}`,
    name: (u.split('/').pop() || `image-${i}`),
    type: 'image/*',
    size: 0,
    isImage: true,
    createdAt: new Date().toISOString(),
    downloadUrl: u,
    isRelativeLocal: isRelativeLocalPath(u)
  } as FileAttachment & { isRelativeLocal?: boolean }));

  // State to hold resolved data URLs for relative local images
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});

  // Effect to load relative local images using the adapter
  useEffect(() => {
    const loadRelativeImages = async () => {
      if (!onLoadRelativeImage) {
        return;
      }

      const newResolvedUrls: Record<string, string> = {};

      for (const imageFile of noteImageFiles) {
        const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
        if (relativeFile.isRelativeLocal && relativeFile.downloadUrl) {
          try {
            const dataUrl = await onLoadRelativeImage(relativeFile.downloadUrl);
            if (dataUrl) {
              newResolvedUrls[relativeFile.downloadUrl] = dataUrl;
            }
          } catch (error) {
            console.warn('Failed to load relative image:', relativeFile.downloadUrl, error);
          }
        }
      }

      if (Object.keys(newResolvedUrls).length > 0) {
        setResolvedImageUrls(prev => ({ ...prev, ...newResolvedUrls }));
      }
    };

    loadRelativeImages();
  }, [noteImageFiles, onLoadRelativeImage]);

  // 添付画像は今後廃止: ノート内の画像のみ扱う
  const imageFiles: FileAttachment[] = noteImageFiles;
  const usingNoteImages = noteImageFiles.length > 0;
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => { setImageIndex(0); }, [node.id]);
  // ノート内の画像出現数が変動した際に、選択インデックスを安全に補正
  useEffect(() => {
    const len = imageFiles.length;
    // 画像が無ければインデックスを0へ
    if (len === 0) {
      if (imageIndex !== 0) setImageIndex(0);
      return;
    }
    // 範囲外になった場合は末尾にクランプ
    if (imageIndex >= len) {
      setImageIndex(len - 1);
    }
  }, [imageFiles.length, imageIndex]);
  const currentImage: FileAttachment | undefined = imageFiles[imageIndex];

  // ノート本文から画像の出現順序でエントリ一覧を抽出
  type NoteImageEntry = { type: 'md' | 'html'; url: string; tag: string; start: number; end: number };
  const extractNoteImageEntries = (note?: string): NoteImageEntry[] => {
    if (!note) return [];
    const entries: NoteImageEntry[] = [];
    const re = /!\[[^\]]*\]\(\s*([^\s)]+)(?:\s+[^)]*)?\)|(<img[^>]*\ssrc=["']([^"'>\s]+)["'][^>]*>)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      const full = m[0];
      const start = m.index;
      const end = start + full.length;
      if (m[2]) {
        // HTML
        const url = m[3];
        entries.push({ type: 'html', url, tag: full, start, end });
      } else {
        // Markdown
        const url = m[1];
        entries.push({ type: 'md', url, tag: full, start, end });
      }
    }
    return entries;
  };

  // 指定インデックスのノート画像サイズ取得（HTMLのみ幅高さ取得可能）
  const parseNoteImageSizeByIndex = (note: string | undefined, index: number): { width: number; height: number } | null => {
    if (!note) return null;
    const entries = extractNoteImageEntries(note);
    const entry = entries[index];
    if (!entry || entry.type !== 'html') return null;
    const tag = entry.tag;
    const wMatch = tag.match(/\swidth=["']?(\d+)(?:px)?["']?/i);
    const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
    if (!wMatch || !hMatch) return null;
    const w = parseInt(wMatch[1], 10);
    const h = parseInt(hMatch[1], 10);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h };
    }
    return null;
  };

  // サイズ（カスタムがあれば優先、なければノート内のHTML画像サイズ属性を使用）
  const noteSize = currentImage ? parseNoteImageSizeByIndex(node.note, imageIndex) : null;
  const imageDimensions = node.customImageWidth && node.customImageHeight
    ? { width: node.customImageWidth, height: node.customImageHeight }
    : noteSize || { width: 150, height: 105 };

  // 決定した画像サイズに基づき、一度だけ自動レイアウトを発火
  const lastLayoutKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onAutoLayout) return;
    if (isResizing) return; // リサイズ中は自動レイアウトを抑止
    const layoutKey = `${node.id}:${imageDimensions.width}x${imageDimensions.height}:${imageIndex}`;
    if (lastLayoutKeyRef.current === layoutKey) return;
    lastLayoutKeyRef.current = layoutKey;
    // レンダリング直後のフレームでレイアウト
    requestAnimationFrame(() => {
      onAutoLayout();
    });
  }, [onAutoLayout, node.id, imageDimensions.width, imageDimensions.height, imageIndex, isResizing]);

  // 画像リサイズハンドラー
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!onUpdateNode) return;
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const currentDimensions = imageDimensions;

    startResizing();
    setResizeStartPos({
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    });
    setResizeStartSize({
      width: currentDimensions.width,
      height: currentDimensions.height
    });
    setOriginalAspectRatio(currentDimensions.width / currentDimensions.height);
  }, [imageDimensions, onUpdateNode, svgRef, zoom, pan, startResizing]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !onUpdateNode || !svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const currentPos = {
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    };

    const deltaX = currentPos.x - resizeStartPos.x;
    const deltaY = currentPos.y - resizeStartPos.y;

    // 対角線方向の距離を計算
    const diagonal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const direction = deltaX + deltaY > 0 ? 1 : -1;

    // 最小・最大サイズの制限
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartSize.width + diagonal * direction));
    const newHeight = newWidth / originalAspectRatio;

    onUpdateNode(node.id, {
      customImageWidth: Math.round(newWidth),
      customImageHeight: Math.round(newHeight)
    });
  }, [isResizing, onUpdateNode, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio, node.id]);

  const updateNoteImageSizeByIndex = (note: string | undefined, index: number, w: number, h: number): string | undefined => {
    if (!note) return note;
    const entries = extractNoteImageEntries(note);
    const entry = entries[index];
    if (!entry) return note;
    const width = Math.round(w);
    const height = Math.round(h);
    let replacement: string;
    if (entry.type === 'html') {
      replacement = entry.tag
        .replace(/\swidth=["']?\d+(?:px)?["']?/ig, '')
        .replace(/\sheight=["']?\d+(?:px)?["']?/ig, '')
        .replace(/<img([^>]*)>/i, (_m, attrs: string) => `<img${attrs} width="${width}" height="${height}">`);
    } else {
      replacement = `<img src="${entry.url}" width="${width}" height="${height}">`;
    }
    return note.slice(0, entry.start) + replacement + note.slice(entry.end);
  };

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      stopResizing();
      // ノート画像のサイズ指定を更新（ノート画像が表示されている場合）
      if (usingNoteImages && onUpdateNode) {
        const newNote = updateNoteImageSizeByIndex(node.note, imageIndex, imageDimensions.width, imageDimensions.height);
        if (newNote && newNote !== node.note) {
          onUpdateNode(node.id, { note: newNote, customImageWidth: imageDimensions.width, customImageHeight: imageDimensions.height });
        }
      }
      // リサイズ後に自動整列
      if (onAutoLayout) {
        requestAnimationFrame(() => {
          onAutoLayout();
        });
      }
    }
  }, [isResizing, stopResizing, onAutoLayout, onUpdateNode, node.id, node.note, imageDimensions.width, imageDimensions.height, usingNoteImages, imageIndex]);

  // マウスイベントリスナーの管理
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isResizing, handleResizeMove, handleResizeEnd]);

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

  // 画像位置計算を統一（ノード上部に配置、4pxマージン）
  const imageY = node.y - nodeHeight / 2 + 4;
  const imageX = node.x - imageDimensions.width / 2;

  // 表示中の画像に合わせてノードの画像サイズを更新
  const handleImageLoadDimensions = useCallback((w: number, h: number) => {
    if (!onUpdateNode) return;
    if (w <= 0 || h <= 0) return;
    // 表示中の画像に合わせて毎回ノードの表示サイズを更新（ノート/添付どちらも）
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, w));
    const ratio = w > 0 ? h / w : 1;
    const newHeight = Math.max(Math.round(newWidth * ratio), Math.round(minWidth * ratio));
    if (node.customImageWidth !== Math.round(newWidth) || node.customImageHeight !== newHeight) {
      onUpdateNode(node.id, { customImageWidth: Math.round(newWidth), customImageHeight: newHeight });
    }
  }, [node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

  // ノート画像の場合、現在の画像のサイズ指定があれば先に反映（ロード完了前にレイアウトを安定させる）
  useEffect(() => {
    if (!onUpdateNode) return;
    if (isResizing) return; // リサイズ中はノート側のサイズ反映で上書きしない
    if (!usingNoteImages) return;
    const sz = parseNoteImageSizeByIndex(node.note, imageIndex);
    if (sz) {
      const minWidth = 50;
      const maxWidth = 400;
      const w = Math.max(minWidth, Math.min(maxWidth, sz.width));
      const h = Math.round(w * (sz.height / Math.max(1, sz.width)));
      if (node.customImageWidth !== w || node.customImageHeight !== h) {
        onUpdateNode(node.id, { customImageWidth: w, customImageHeight: h });
      }
    }
  }, [isResizing, usingNoteImages, imageIndex, node.note, node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

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

  // 画像がない場合は基本のNodeレンダリングのみ（フック定義の後で判定し、Hooks規約を満たす）
  if (!currentImage) {
    return (
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
    );
  }

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

      {/* ノートまたは添付の画像を表示（切替可能） */}
      <g key={currentImage.id}>
          <foreignObject
            x={imageX}
            y={imageY}
            width={imageDimensions.width}
            height={imageDimensions.height}
          >
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
              transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', // スムーズなサイズ変更アニメーション
              cursor: 'pointer'
            }}
            onClick={(e) => handleImageClick(e as any, currentImage)}
            onDoubleClick={(e) => handleImageDoubleClick(e as any, currentImage)}
            onContextMenu={(e) => handleFileActionMenu(e as any, currentImage)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            >
              <img
                src={(() => {
                  // Use resolved data URL for relative local images
                  const relativeFile = currentImage as FileAttachment & { isRelativeLocal?: boolean };
                  if (relativeFile.isRelativeLocal && relativeFile.downloadUrl && resolvedImageUrls[relativeFile.downloadUrl]) {
                    return resolvedImageUrls[relativeFile.downloadUrl];
                  }
                  return currentImage.downloadUrl || currentImage.dataURL || currentImage.data;
                })()}
                alt={currentImage.name}
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
                onClick={(e) => handleImageClick(e, currentImage)}
                onDoubleClick={(e) => handleImageDoubleClick(e, currentImage)}
                onContextMenu={(e) => handleFileActionMenu(e, currentImage)}
                onError={() => {}}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const w = img.naturalWidth || 0;
                  const h = img.naturalHeight || 0;
                  if (w > 0 && h > 0) {
                    handleImageLoadDimensions(w, h);
                  }
                }}
              />

              {/* 画像切替コントロール（ノード選択時またはホバー時のみ表示） */}
              {imageFiles.length > 1 && (isSelected || isHovered) && (
                (() => {
                  const tiny = imageDimensions.width < 100;
                  const compact = imageDimensions.width < 140;
                  const fontSize = tiny ? 9 : (compact ? 10 : 12);
                  const padH = tiny ? '0 3px' : (compact ? '1px 4px' : '2px 6px');
                  const btnPad = tiny ? '0 3px' : '0 4px';
                  return (
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
                        onClick={(e) => { e.stopPropagation(); setImageIndex((prev) => (prev - 1 + imageFiles.length) % imageFiles.length); }}
                        style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
                        aria-label="前の画像"
                        title="前の画像"
                      >
                        ‹
                      </button>
                      <div style={{ fontSize: fontSize - 1 }}>{imageIndex + 1}/{imageFiles.length}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setImageIndex((prev) => (prev + 1) % imageFiles.length); }}
                        style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
                        aria-label="次の画像"
                        title="次の画像"
                      >
                        ›
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
          </foreignObject>

          {/* 画像選択時の枠線とリサイズハンドル */}
          {isSelected && (
            <g>
              {/* 枠線 */}
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

              {/* リサイズハンドル（右下） */}
              <g>
                {/* ハンドル背景 */}
                <rect
                  x={imageX + imageDimensions.width - 4}
                  y={imageY + imageDimensions.height - 4}
                  width="8"
                  height="8"
                  fill="white"
                  stroke="#bfdbfe"
                  strokeWidth="1"
                  rx="1"
                  ry="1"
                  style={{
                    cursor: isResizing ? 'nw-resize' : 'se-resize',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={handleResizeStart}
                />
                {/* リサイズハンドルのアイコン（斜め線） */}
                <g stroke="#6b7280" strokeWidth="1" style={{ pointerEvents: 'none' }}>
                  <line
                    x1={imageX + imageDimensions.width - 2}
                    y1={imageY + imageDimensions.height - 2}
                    x2={imageX + imageDimensions.width + 2}
                    y2={imageY + imageDimensions.height - 6}
                  />
                  <line
                    x1={imageX + imageDimensions.width - 1}
                    y1={imageY + imageDimensions.height - 3}
                    x2={imageX + imageDimensions.width + 1}
                    y2={imageY + imageDimensions.height - 5}
                  />
                  <line
                    x1={imageX + imageDimensions.width}
                    y1={imageY + imageDimensions.height - 4}
                    x2={imageX + imageDimensions.width}
                    y2={imageY + imageDimensions.height - 4}
                  />
                </g>
              </g>
            </g>
          )}
        </g>
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