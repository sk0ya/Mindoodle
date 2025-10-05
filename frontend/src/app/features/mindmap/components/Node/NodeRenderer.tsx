import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import MermaidRenderer from './MermaidRenderer';
import { useMindMapStore } from '@mindmap/store';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useResizingState, useHoverState } from '@shared/hooks';
import {
  getBaseNodeStyles,
  getSelectionBorderStyles,
  getBackgroundFill,
  DEFAULT_ANIMATION_CONFIG
} from '@mindmap/handlers/BaseRenderer';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';

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
  // Checkbox functionality
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
  // Original NodeAttachments props
  svgRef,
  zoom,
  pan,
  onSelectNode,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout,
  // Checkbox functionality
  onToggleCheckbox
}) => {
  const { settings, normalizedData } = useMindMapStore();

  // 画像リサイズ状態管理
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

  // チェックボックスのクリックハンドラー（データファースト更新）
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onToggleCheckbox && node.markdownMeta?.isCheckbox) {
      // 正規化データから最新の状態を取得
      const normalizedNode = normalizedData?.nodes[node.id];
      const currentChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta?.isChecked ?? false;
      const newChecked = !currentChecked;

      // 即座にデータを更新（UIは自動的に追従）
      onToggleCheckbox(node.id, newChecked);
    }
  }, [onToggleCheckbox, node.id, node.markdownMeta?.isCheckbox, normalizedData]);

  // Display entries: images (md/html) and mermaid blocks in note order
  type DisplayEntry =
    | { kind: 'image'; subType: 'md' | 'html'; url: string; tag: string; start: number; end: number }
    | { kind: 'mermaid'; code: string; start: number; end: number };

  const extractDisplayEntries = (note?: string): DisplayEntry[] => {
    if (!note) return [];
    const entries: DisplayEntry[] = [];
    const re = /!\[[^\]]*\]\(\s*([^\s)]+)(?:\s+[^)]*)?\)|(<img[^>]*\ssrc=["']([^"'>\s]+)["'][^>]*>)|(```mermaid[\s\S]*?```)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      const full = m[0];
      const start = m.index;
      const end = start + full.length;
      if (m[4]) {
        entries.push({ kind: 'mermaid', code: full, start, end });
      } else if (m[2]) {
        const url = m[3];
        entries.push({ kind: 'image', subType: 'html', url, tag: full, start, end });
      } else {
        const url = m[1];
        entries.push({ kind: 'image', subType: 'md', url, tag: full, start, end });
      }
    }
    return entries;
  };

  // Check if a path is a relative local file path
  const isRelativeLocalPath = (path: string): boolean => {
    if (/^(https?:|data:|blob:)/i.test(path)) return false;
    return path.startsWith('./') || path.startsWith('../') || (!path.includes('://') && !path.startsWith('/'));
  };

  const displayEntries = extractDisplayEntries(node.note);
  const imageEntries = displayEntries.filter((e): e is Extract<DisplayEntry, { kind: 'image' }> => e.kind === 'image');
  const noteImageFiles: FileAttachment[] = imageEntries.map((e, i) => ({
    id: `noteimg-${node.id}-${i}`,
    name: (e.url.split('/').pop() || `image-${i}`),
    type: 'image/*',
    size: 0,
    isImage: true,
    createdAt: new Date().toISOString(),
    downloadUrl: e.url,
    isRelativeLocal: isRelativeLocalPath(e.url)
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

  // 画像とMermaidを統一した表示インデックス
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

  // Mermaid is treated as one of display entries (no priority)

  // ノート中のサイズ指定（HTML画像のみ）を参照
  const parseNoteSizeByIndex = (note: string | undefined, index: number): { width: number; height: number } | null => {
    if (!note) return null;
    const entry = displayEntries[index];
    if (!entry || entry.kind !== 'image' || entry.subType !== 'html') return null;
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

  // (old parseNoteImageSizeByIndex removed; merged into parseNoteSizeByIndex)

  // サイズ（カスタムがあれば優先、なければノート内のHTML画像サイズ属性を使用）
  const noteSize = currentEntry ? parseNoteSizeByIndex(node.note, slotIndex) : null;
  // If table node, prefer using existing node size props
  const imageDimensionsBase = node.customImageWidth && node.customImageHeight
    ? { width: node.customImageWidth, height: node.customImageHeight }
    : noteSize || { width: 150, height: 105 };
  const imageDimensions = (node.kind === 'table')
    ? { width: node.customImageWidth ?? Math.max(50, nodeWidth - 10), height: node.customImageHeight ?? imageHeight }
    : imageDimensionsBase;

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

  // 画像リサイズハンドラー
  const [localDims, setLocalDims] = useState<{ width: number; height: number } | null>(null);
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!onUpdateNode) return;
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const scale = zoom * 1.5; // match CanvasRenderer group scale
    const currentDimensions = imageDimensions;

    startResizing();
    setResizeStartPos({
      x: (e.clientX - svgRect.left) / scale - pan.x,
      y: (e.clientY - svgRect.top) / scale - pan.y
    });
    setResizeStartSize({
      width: currentDimensions.width,
      height: currentDimensions.height
    });
    setOriginalAspectRatio(currentDimensions.width / currentDimensions.height);
    setLocalDims({ width: currentDimensions.width, height: currentDimensions.height });
  }, [imageDimensions, onUpdateNode, svgRef, zoom, pan, startResizing]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !onUpdateNode || !svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const scale = zoom * 1.5; // match CanvasRenderer group scale
    const currentPos = {
      x: (e.clientX - svgRect.left) / scale - pan.x,
      y: (e.clientY - svgRect.top) / scale - pan.y
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

    setLocalDims({ width: Math.round(newWidth), height: Math.round(newHeight) });
  }, [isResizing, onUpdateNode, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio, node.id]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}
    handleResizeStart(e as unknown as React.MouseEvent);
  }, [handleResizeStart]);

  const updateNoteImageSizeByIndex = (note: string | undefined, index: number, w: number, h: number): string | undefined => {
    if (!note) return note;
    const entry = displayEntries[index];
    if (!entry) return note;
    if ((entry as any).kind && (entry).kind !== 'image') return note;
    const width = Math.round(w);
    const height = Math.round(h);
    let replacement: string;
    const imgEntry = entry as Extract<DisplayEntry, { kind: 'image' }>;
    if (imgEntry.subType === 'html') {
      replacement = imgEntry.tag
        .replace(/\swidth=["']?\d+(?:px)?["']?/ig, '')
        .replace(/\sheight=["']?\d+(?:px)?["']?/ig, '')
        .replace(/<img([^>]*)>/i, (_m, attrs: string) => `<img${attrs} width="${width}" height="${height}">`);
    } else {
      replacement = `<img src="${imgEntry.url}" width="${width}" height="${height}">`;
    }
    return note.slice(0, imgEntry.start) + replacement + note.slice(imgEntry.end);
  };

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    stopResizing();

    const finalW = Math.round(localDims?.width ?? imageDimensions.width);
    const finalH = Math.round(localDims?.height ?? imageDimensions.height);


    if (onUpdateNode) {
      const updates: Partial<MindMapNode> = { customImageWidth: finalW, customImageHeight: finalH };
      // Only update note markup when resizing embedded note images
      if (node.kind !== 'table') {
        const maybeUpdatedNote = updateNoteImageSizeByIndex(node.note, slotIndex, finalW, finalH);
        if (maybeUpdatedNote && maybeUpdatedNote !== node.note) {
          (updates as any).note = maybeUpdatedNote;
        }
      }
      onUpdateNode(node.id, updates);
    }

    setLocalDims(null);
    if (onAutoLayout) {
      requestAnimationFrame(() => { onAutoLayout(); });
    }
  }, [isResizing, stopResizing, onAutoLayout, onUpdateNode, node.id, node.note, imageDimensions.width, imageDimensions.height, slotIndex, localDims]);

  // マウス/ポインタイベントリスナーの管理（foreignObject越境対策）
  useEffect(() => {
    if (isResizing) {
      const mouseMove = (e: MouseEvent) => handleResizeMove(e);
      const mouseUp = () => handleResizeEnd();
      const pointerMove = (e: PointerEvent) => handleResizeMove(e as unknown as MouseEvent);
      const pointerUp = () => handleResizeEnd();

      window.addEventListener('mousemove', mouseMove);
      window.addEventListener('mouseup', mouseUp);
      window.addEventListener('pointermove', pointerMove);
      window.addEventListener('pointerup', pointerUp);

      return () => {
        window.removeEventListener('mousemove', mouseMove);
        window.removeEventListener('mouseup', mouseUp);
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
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
  const renderDims = localDims || imageDimensions;
  const imageY = node.kind === 'table'
    ? node.y - renderDims.height / 2  // テーブルは実際のレンダリングサイズの中心に配置
    : node.y - nodeHeight / 2 + 4;    // 他のノードは従来通り
  const imageX = node.x - renderDims.width / 2;

  // no-op

  // A) 画像/Mermaidを切り替えたら、そのエントリ固有のサイズに合わせる
  // エントリキー（画像:URL / Mermaid:コード先頭と長さ）
  const getEntryKey = (entry?: DisplayEntry): string => {
    if (!entry) return 'none';
    if (entry.kind === 'image') return `img:${entry.url}`;
    if (entry.kind === 'mermaid') {
      const code = entry.code || '';
      return `mmd:${code.length}:${code.slice(0, 50)}`;
    }
    return 'none';
  };
  const prevEntryKeyRef = useRef<string>('');
  useEffect(() => {
    const key = node.kind === 'table' ? `tbl:${(node as any).tableData?.rows?.length || 0}` : getEntryKey(currentEntry);
    if (key !== prevEntryKeyRef.current) {
      prevEntryKeyRef.current = key;
      // 新しいエントリの自然サイズに合わせるため、一旦カスタムサイズを解除
      setLocalDims(null);
      if (onUpdateNode) {
        onUpdateNode(node.id, { customImageWidth: undefined as unknown as number, customImageHeight: undefined as unknown as number });
      }
      // autoLayoutはsize決定後（onLoadやonLoadedDimensions後）に発火する既存ロジックで反映
    }
  }, [currentEntry, node.id, onUpdateNode]);

  // 表示中の画像に合わせてノードの画像サイズを更新
  const handleImageLoadDimensions = useCallback((w: number, h: number) => {
    if (!onUpdateNode) return;
    if (w <= 0 || h <= 0) return;
    // 既にユーザーがカスタム設定済みなら、ロード寸法で上書きしない
    if (node.customImageWidth && node.customImageHeight) return;
    // 初回のみ、表示中の画像に合わせてノードの表示サイズを設定
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, w));
    const ratio = w > 0 ? h / w : 1;
    const newHeight = Math.max(Math.round(newWidth * ratio), Math.round(minWidth * ratio));
    onUpdateNode(node.id, { customImageWidth: Math.round(newWidth), customImageHeight: newHeight });
  }, [node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

  // ノートのHTML画像にサイズ指定があれば先に反映（ロード完了前にレイアウトを安定）
  useEffect(() => {
    if (!onUpdateNode) return;
    if (isResizing) return;
    // 一度でもカスタムサイズが設定されたら、ノート側のサイズで上書きしない
    if (node.customImageWidth && node.customImageHeight) return;
    const sz = parseNoteSizeByIndex(node.note, slotIndex);
    if (sz) {
      const minWidth = 50;
      const maxWidth = 400;
      const w = Math.max(minWidth, Math.min(maxWidth, sz.width));
      const h = Math.round(w * (sz.height / Math.max(1, sz.width)));
      onUpdateNode(node.id, { customImageWidth: w, customImageHeight: h });
    }
  }, [isResizing, slotIndex, node.note, node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

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

  // 画像もMermaidもなく、かつテーブルノードでもない場合は背景のみ
  if (!currentEntry && node.kind !== 'table') {
    // 正規化データを優先して、最新の状態を即座に反映
    const normalizedNode = normalizedData?.nodes[node.id];
    const isCheckboxNode = normalizedNode?.markdownMeta?.isCheckbox ?? node.markdownMeta?.isCheckbox ?? false;
    const isChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta?.isChecked ?? false;
    const checkboxSize = 16;
    const checkboxMargin = 8;

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

        {/* チェックボックスの表示 */}
        {isCheckboxNode && (
          <g>
            {/* チェックボックス背景 */}
            <rect
              x={nodeLeftX + checkboxMargin}
              y={node.y - checkboxSize / 2}
              width={checkboxSize}
              height={checkboxSize}
              fill={isChecked ? '#4caf50' : 'white'}
              stroke={isChecked ? '#4caf50' : '#ccc'}
              strokeWidth="1"
              rx="2"
              ry="2"
              onClick={handleCheckboxClick}
              style={{ cursor: 'pointer' }}
            />

            {/* チェックマーク */}
            {isChecked && (
              <path
                d={`M${nodeLeftX + checkboxMargin + 3} ${node.y - 1} L${nodeLeftX + checkboxMargin + 7} ${node.y + 3} L${nodeLeftX + checkboxMargin + 13} ${node.y - 5}`}
                stroke="white"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                onClick={handleCheckboxClick}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              />
            )}
          </g>
        )}
      </g>
    );
  }

  // 現在のスロットがMermaidかどうか
  const showMermaid = !!currentEntry && (currentEntry).kind === 'mermaid';

  // Table node flag
  const isTableNode = node.kind === 'table';

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

      {/* ノート内Mermaid / 画像 または テーブルノードを表示 */}
      <g key={showMermaid ? `mermaid-${node.id}` : (isTableNode ? `table-${node.id}` : (currentImage ? currentImage.id : `empty-${node.id}`))}>
          <foreignObject
            x={imageX}
            y={imageY}
            width={renderDims.width}
            height={renderDims.height}
          >
            {showMermaid ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <MermaidRenderer
                  code={(currentEntry).code}
                  onLoadedDimensions={(w, h) => {
                    // mimic image load sizing behavior
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
                {/* 切替コントロール（Mermaid表示時も有効） */}
                {displayEntries.length > 1 && (isSelected || isHovered) && (
                  (() => {
                    const tiny = renderDims.width < 100;
                    const compact = renderDims.width < 140;
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
                          onClick={(e) => { e.stopPropagation(); setSlotIndex((prev) => (prev - 1 + displayEntries.length) % displayEntries.length); }}
                          style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
                          aria-label="前の画像"
                          title="前の画像"
                        >
                          ‹
                        </button>
                        <div style={{ fontSize: fontSize - 1 }}>{slotIndex + 1}/{displayEntries.length}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSlotIndex((prev) => (prev + 1) % displayEntries.length); }}
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
                {isSelected && (
                  <div
                    onPointerDown={handleResizePointerDown}
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
                )}
              </div>
            ) : isTableNode ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
                   onClick={(e) => { e.stopPropagation(); if (!isSelected && onSelectNode) onSelectNode(node.id); }}
                   onDoubleClick={(e) => { e.stopPropagation(); }}
                   onContextMenu={onContextMenu}
                   onMouseEnter={handleMouseEnter}
                   onMouseLeave={handleMouseLeave}
              >
                <div className="table-wrap" style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'auto',
                  borderRadius: '10px',
                  boxSizing: 'border-box'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    overflow: 'hidden',
                    borderRadius: '10px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    background: 'white',
                    fontSize: `${(settings.fontSize || node.fontSize || 14) * 0.95}px`,
                    lineHeight: 1.5
                  }}>
                    {(() => {
                      // Build rows to render from structured data or fallback parse from text/note
                      const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
                        if (!src) return null;
                        const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
                        for (let i = 0; i < lines.length - 1; i++) {
                          const header = lines[i];
                          const sep = lines[i + 1];
                          const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
                          const isSep = /:?-{3,}:?\s*\|/.test(sep) || /^\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)\|?$/.test(sep);
                          if (isHeader && isSep) {
                            const outRows: string[][] = [];
                            const toCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
                            const headers = toCells(header);
                            outRows.push(headers);
                            let j = i + 2;
                            while (j < lines.length && lines[j].includes('|')) {
                              outRows.push(toCells(lines[j]));
                              j++;
                            }
                            return { headers, rows: outRows.slice(1) };
                          }
                        }
                        return null;
                      };

                      // Prefer parsing from node.text (canonical); fallback to note
                      let parsed = parseTableFromString(node.text) || parseTableFromString((node as any).note);
                      if (!parsed) {
                        const td = (node as any).tableData as { headers?: string[]; rows?: string[][] } | undefined;
                        if (td && Array.isArray(td.rows)) {
                          parsed = { headers: td.headers, rows: td.rows } as any;
                        }
                      }

                      const headers = parsed?.headers;
                      const dataRows = parsed?.rows || [];
                      const rowsOrPlaceholder = headers || dataRows.length > 0 ? [headers, ...dataRows].filter(Boolean) : [['', ''], ['', '']];

                      const hasHeaders = !!headers;

                      return (
                        <>
                          {hasHeaders && (
                            <thead>
                              <tr>
                                {headers.map((cell: string, ci: number) => (
                                  <th
                                    key={ci}
                                    style={{
                                      border: 0,
                                      borderRight: ci < headers.length - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined,
                                      padding: '12px 16px',
                                      verticalAlign: 'middle',
                                      fontWeight: 600,
                                      background: '#6b7280',
                                      color: 'white',
                                      borderBottom: '2px solid #e2e8f0',
                                      textAlign: 'left',
                                      borderTopLeftRadius: ci === 0 ? '10px' : undefined,
                                      borderTopRightRadius: ci === headers.length - 1 ? '10px' : undefined,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >{cell}</th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {(hasHeaders ? dataRows : rowsOrPlaceholder).filter((row): row is string[] => !!row).map((row: string[], ri: number) => {
                              const isLastRow = ri === (hasHeaders ? dataRows : rowsOrPlaceholder).length - 1;
                              return (
                                <tr
                                  key={ri}
                                  style={{
                                    transition: 'background 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = ri % 2 === 0 ? 'white' : '#fcfcfd';
                                  }}
                                >
                                  {row.map((cell: string, ci: number) => (
                                    <td
                                      key={ci}
                                      style={{
                                        border: 0,
                                        padding: '12px 16px',
                                        verticalAlign: 'middle',
                                        background: ri % 2 === 0 ? 'white' : '#fcfcfd',
                                        color: 'black',
                                        borderTop: ri > 0 ? '1px solid #f1f5f9' : undefined,
                                        borderBottomLeftRadius: isLastRow && ci === 0 ? '10px' : undefined,
                                        borderBottomRightRadius: isLastRow && ci === row.length - 1 ? '10px' : undefined,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >{cell}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </>
                      );
                    })()}
                  </table>
                </div>
                {/* No resize handle for table nodes */}
              </div>
            ) : (
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
              onClick={(e) => currentImage && handleImageClick(e as any, currentImage)}
              onDoubleClick={(e) => currentImage && handleImageDoubleClick(e as any, currentImage)}
              onContextMenu={(e) => currentImage && handleFileActionMenu(e as any, currentImage)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              >
                {currentImage && (
                  <img
                    src={(() => {
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
                )}

                {/* 画像切替コントロール（ノード選択時またはホバー時のみ表示） */}
                {displayEntries.length > 1 && (isSelected || isHovered) && (
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
                          onClick={(e) => { e.stopPropagation(); setSlotIndex((prev) => (prev - 1 + displayEntries.length) % displayEntries.length); }}
                          style={{ background: 'transparent', color: '#fff', border: 'none', padding: btnPad, cursor: 'pointer', fontSize }}
                          aria-label="前の画像"
                          title="前の画像"
                        >
                          ‹
                        </button>
                        <div style={{ fontSize: fontSize - 1 }}>{slotIndex + 1}/{displayEntries.length}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSlotIndex((prev) => (prev + 1) % displayEntries.length); }}
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

                {isSelected && (
                  <div
                    onPointerDown={handleResizePointerDown}
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
                )}

              </div>
            )}
          </foreignObject>

          {/* 画像選択時の枠線とリサイズハンドル（表ノードでは非表示） */}
          {isSelected && node.kind !== 'table' && (
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

              {/* リサイズハンドル（SVGの上ではなく、foreignObject内に配置するためここでは描画しない） */}
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
      style={{
        ...borderStyles.style,
        transition: 'none' // 外枠の移動アニメーションを無効化
      }}
    />
  );
};

export default memo(NodeRenderer, (prevProps, nextProps) => {
  // markdownMetaの変更も検知するようにカスタム比較関数を追加
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.text === nextProps.node.text &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.nodeWidth === nextProps.nodeWidth &&
    prevProps.nodeHeight === nextProps.nodeHeight &&
    JSON.stringify(prevProps.node.markdownMeta) === JSON.stringify(nextProps.node.markdownMeta)
  );
});
