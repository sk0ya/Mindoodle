import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Extracted helper to avoid nested function definitions in render
const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
  if (!src) return null;
  const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const sep = lines[i + 1];
    const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
    const parts = sep.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
    const isSep = parts.length > 0 && parts.every(cell => /^:?-{3,}:?$/.test(cell));
    if (isHeader && isSep) {
      const toCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headers = toCells(header);
      const outRows: string[][] = [];
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

  
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

  
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

  
  type DisplayEntry =
    | { kind: 'image'; subType: 'md' | 'html'; url: string; tag: string; start: number; end: number }
    | { kind: 'mermaid'; code: string; start: number; end: number };

  const extractDisplayEntries = (note?: string): DisplayEntry[] => {
    if (!note) return [];
    const entries: DisplayEntry[] = [];
    // 1) Mermaid code blocks: find "```mermaid" and close "```"
    let idx = 0;
    while (idx < note.length) {
      const start = note.indexOf("```mermaid", idx);
      if (start === -1) break;
      const endFence = note.indexOf("```", start + 9);
      if (endFence !== -1) {
        const end = endFence + 3;
        const code = note.slice(start, end);
        entries.push({ kind: 'mermaid', code, start, end });
        idx = end;
      } else {
        break;
      }
    }
    // 2) Markdown image syntax ![alt](url)
    idx = 0;
    while (idx < note.length) {
      const bang = note.indexOf('![', idx);
      if (bang === -1) break;
      const rbracket = note.indexOf('](', bang + 2);
      if (rbracket === -1) { idx = bang + 2; continue; }
      const close = note.indexOf(')', rbracket + 2);
      if (close === -1) { idx = rbracket + 2; continue; }
      const full = note.slice(bang, close + 1);
      // Extract URL part between '(' and ')', ignore spaces
      const raw = note.slice(rbracket + 2, close).trim();
      const url = raw.split(/\s+/)[0];
      entries.push({ kind: 'image', subType: 'md', url, tag: full, start: bang, end: close + 1 });
      idx = close + 1;
    }
    // 3) HTML <img ... src="..." ...>
    idx = 0;
    const lower = note.toLowerCase();
    while (idx < note.length) {
      const tagStart = lower.indexOf('<img', idx);
      if (tagStart === -1) break;
      const tagEnd = note.indexOf('>', tagStart + 4);
      const tag = tagEnd !== -1 ? note.slice(tagStart, tagEnd + 1) : note.slice(tagStart);
      // Find src attribute
      const srcPos = tag.toLowerCase().indexOf('src=');
      if (srcPos !== -1) {
        const rest = tag.slice(srcPos + 4).trim();
        const quote = rest[0];
        let url = '';
        if (quote === '"' || quote === '\'') {
          const qEnd = rest.indexOf(quote, 1);
          url = qEnd > 0 ? rest.slice(1, qEnd) : '';
        } else {
          // unquoted
          const sp = rest.search(/[\s>]/);
          url = sp > 0 ? rest.slice(0, sp) : rest;
        }
        entries.push({ kind: 'image', subType: 'html', url, tag, start: tagStart, end: tagStart + tag.length });
      }
      idx = tagEnd === -1 ? tagStart + 4 : tagEnd + 1;
    }
    entries.sort((a, b) => a.start - b.start);
    return entries;
  };

  
  const isRelativeLocalPath = (path: string): boolean => {
    if (/^(https?:|data:|blob:)/i.test(path)) return false;
    return path.startsWith('./') || path.startsWith('../') || (!path.includes('://') && !path.startsWith('/'));
  };

  // Extract display entries from both text and note
  const textEntries = extractDisplayEntries(node.text);
  const noteEntries = extractDisplayEntries(node.note);
  const displayEntries = [...textEntries, ...noteEntries];

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

      // 未解決の相対パス画像をフィルタリング
      const pendingImages = noteImageFiles
        .filter(imageFile => {
          const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
          return relativeFile.isRelativeLocal &&
                 relativeFile.downloadUrl &&
                 !resolvedImageUrls[relativeFile.downloadUrl];
        });

      if (pendingImages.length === 0) {
        return;
      }

      // 並列読み込み
      const loadPromises = pendingImages.map(async (imageFile) => {
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
        setResolvedImageUrls(prev => ({ ...prev, ...newResolvedUrls }));
      }
    };

    loadRelativeImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrlsKey, onLoadRelativeImage, node.id]);

  
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

  


  const parseNoteSizeByIndex = useCallback((index: number): { width: number; height: number } | null => {
    const entry = displayEntries[index];
    if (!entry || entry.kind !== 'image' || entry.subType !== 'html') {
      return null;
    }

    const tag = entry.tag;
    const wRe = /\swidth=["']?(\d+)(?:px)?["']?/i;
    const hRe = /\sheight=["']?(\d+)(?:px)?["']?/i;
    const wMatch = wRe.exec(tag);
    const hMatch = hRe.exec(tag);
    if (!wMatch || !hMatch) return null;
    const w = parseInt(wMatch[1], 10);
    const h = parseInt(hMatch[1], 10);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h };
    }
    return null;
  }, [displayEntries]);

  // (old parseNoteImageSizeByIndex removed; merged into parseNoteSizeByIndex)

  // サイズ（カスタムがあれば優先、なければノート内のHTML画像サイズ属性を使用）
  const noteSize = currentEntry ? parseNoteSizeByIndex(slotIndex) : null;


  // If table node, prefer using existing node size props
  const imageDimensions = useMemo(() => {
    const imageDimensionsBase = node.customImageWidth && node.customImageHeight
      ? { width: node.customImageWidth, height: node.customImageHeight }
      : noteSize || { width: 150, height: 105 };

    return (node.kind === 'table')
      ? { width: node.customImageWidth ?? Math.max(50, nodeWidth - 10), height: node.customImageHeight ?? imageHeight }
      : imageDimensionsBase;
  }, [node.customImageWidth, node.customImageHeight, node.kind, noteSize, nodeWidth, imageHeight, node.id]);

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
  }, [isResizing, onUpdateNode, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const target = e.currentTarget;
      if (target && 'setPointerCapture' in target && typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(e.pointerId);
      }
    } catch {}
    handleResizeStart(e as unknown as React.MouseEvent);
  }, [handleResizeStart]);

  const updateNoteImageSizeByIndex = useCallback((note: string | undefined, index: number, w: number, h: number): string | undefined => {
    if (!note) return note;
    const entry = displayEntries[index];
    if (!entry) return note;
    if (entry.kind !== 'image') return note;
    const width = Math.round(w);
    const height = Math.round(h);
    let replacement: string;
    const imgEntry = entry;
    if (imgEntry.subType === 'html') {
      replacement = imgEntry.tag
        .replace(/\swidth=["']?\d+(?:px)?["']?/ig, '')
        .replace(/\sheight=["']?\d+(?:px)?["']?/ig, '')
        .replace(/<img([^>]*)>/i, (_m, attrs: string) => `<img${attrs} width="${width}" height="${height}">`);
    } else {
      replacement = `<img src="${imgEntry.url}" width="${width}" height="${height}">`;
    }
    return note.slice(0, imgEntry.start) + replacement + note.slice(imgEntry.end);
  }, [displayEntries]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    stopResizing();

    const finalW = Math.round(localDims?.width ?? imageDimensions.width);
    const finalH = Math.round(localDims?.height ?? imageDimensions.height);


    if (onUpdateNode) {
      const updates: Partial<MindMapNode> & { note?: string } = { customImageWidth: finalW, customImageHeight: finalH };
      // Only update note markup when resizing embedded note images
      if (node.kind !== 'table') {
        const maybeUpdatedNote = updateNoteImageSizeByIndex(node.note, slotIndex, finalW, finalH);
        if (maybeUpdatedNote && maybeUpdatedNote !== node.note) {
          updates.note = maybeUpdatedNote;
        }
      }
      onUpdateNode(node.id, updates);
    }

    setLocalDims(null);
    if (onAutoLayout) {
      requestAnimationFrame(() => { onAutoLayout(); });
    }
  }, [isResizing, stopResizing, onAutoLayout, onUpdateNode, node.id, node.kind, node.note, imageDimensions.width, imageDimensions.height, slotIndex, localDims, updateNoteImageSizeByIndex]);

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
  const getEntryKey = useCallback((entry?: DisplayEntry): string => {
    if (!entry) return 'none';
    if (entry.kind === 'image') return `img:${entry.url}`;
    if (entry.kind === 'mermaid') {
      const code = entry.code || '';
      return `mmd:${code.length}:${code.slice(0, 50)}`;
    }
    return 'none';
  }, []);
  const prevEntryKeyRef = useRef<string>('');
  useEffect(() => {
    type TableNode = MindMapNode & { tableData?: { headers?: string[]; rows?: string[][] } };
    const key = node.kind === 'table' ? `tbl:${(node as TableNode).tableData?.rows?.length || 0}` : getEntryKey(currentEntry);
    if (key !== prevEntryKeyRef.current) {
      prevEntryKeyRef.current = key;
      // 新しいエントリの自然サイズに合わせるため、一旦カスタムサイズを解除
      setLocalDims(null);
      if (onUpdateNode) {
        onUpdateNode(node.id, { customImageWidth: undefined as unknown as number, customImageHeight: undefined as unknown as number });
      }
      // autoLayoutはsize決定後（onLoadやonLoadedDimensions後）に発火する既存ロジックで反映
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry, node.id, node.kind, getEntryKey, onUpdateNode]);

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

        {}
        {isCheckboxNode && (
          <g>
            {}
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

            {}
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
                {}
                {displayEntries.length > 1 && (isSelected || isHovered) && (
                  (() => {
                    const tiny = renderDims.width < 100;
                    const compact = renderDims.width < 140;
                    let fontSize = 12;
                    if (tiny) fontSize = 9; else if (compact) fontSize = 10;
                    let padH = '2px 6px';
                    if (tiny) padH = '0 3px'; else if (compact) padH = '1px 4px';
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
            {!showMermaid && isTableNode && (
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
                  overflow: 'hidden',
                  borderRadius: '10px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <table style={{
                    width: 'auto',
                    borderCollapse: 'collapse',
                    overflow: 'hidden',
                    borderRadius: '10px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    background: 'white',
                    fontSize: `${(settings.fontSize || node.fontSize || 14) * 0.95}px`,
                    lineHeight: 1.5
                  }}>
                    {(() => {
                      type TableNode = MindMapNode & { note?: string; tableData?: { headers?: string[]; rows?: string[][] } };
                      const tableNode = node as TableNode;
                      // Prefer parsing from node.text (canonical); fallback to note
                      let parsed = parseTableFromString(node.text) || parseTableFromString(tableNode.note);
                      if (!parsed) {
                        const td = tableNode.tableData;
                        if (td && Array.isArray(td.rows)) {
                          parsed = { headers: td.headers, rows: td.rows };
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
                {}
              </div>
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
                {currentImage && (() => {
                  const relativeFile = currentImage as FileAttachment & { isRelativeLocal?: boolean };

                  // 画像のソースURL決定
                  let imageSrc = '';

                  if (relativeFile.isRelativeLocal && relativeFile.downloadUrl) {
                    // 相対パスの場合：解決済みDataURLのみ使用（まだ解決されていない場合はローディング表示）
                    imageSrc = resolvedImageUrls[relativeFile.downloadUrl] || '';

                    if (!imageSrc) {
                      // まだ読み込み中
                      return (
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
                          画像を読み込み中...
                        </div>
                      );
                    }
                  } else {
                    // 絶対URLまたはDataURLの場合：優先順位に従って選択
                    imageSrc = currentImage.dataURL || currentImage.downloadUrl || currentImage.data || '';
                  }

                  // 画像ソースが無効な場合はプレースホルダーを表示
                  if (!imageSrc) {
                    return (
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
                        画像を読み込めません
                      </div>
                    );
                  }

                  return (
                    <img
                      src={imageSrc}
                      alt={currentImage.name || '画像'}
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
                      onError={(e) => {
                        console.warn('[NodeRenderer] 画像の読み込みに失敗:', {
                          name: currentImage.name,
                          src: imageSrc,
                          isRelative: relativeFile.isRelativeLocal
                        });
                        // エラー時はalt属性でフォールバック表示
                        const img = e.currentTarget;
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          const errorDiv = document.createElement('div');
                          errorDiv.style.cssText = `
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
                          errorDiv.textContent = `画像の読み込みに失敗しました\n${currentImage.name}`;
                          parent.appendChild(errorDiv);
                        }
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        const w = img.naturalWidth || 0;
                        const h = img.naturalHeight || 0;
                        if (w > 0 && h > 0) {
                          handleImageLoadDimensions(w, h);
                        }
                      }}
                    />
                  );
                })()}

                {}
                {displayEntries.length > 1 && (isSelected || isHovered) && (
                  (() => {
                    const tiny = imageDimensions.width < 100;
                    const compact = imageDimensions.width < 140;
                    let fontSize = 12;
                    if (tiny) fontSize = 9;
                    else if (compact) fontSize = 10;

                    let padH = '2px 6px';
                    if (tiny) padH = '0 3px';
                    else if (compact) padH = '1px 4px';

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
