import { useState, useCallback, useEffect } from 'react';
import type { MindMapNode } from '@shared/types';
import { useResizingState } from '@shared/hooks';
import type { DisplayEntry } from './nodeRendererHelpers';

interface UseImageResizeProps {
  node: MindMapNode;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  imageDimensions: { width: number; height: number };
  slotIndex: number;
  displayEntries: DisplayEntry[];
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
}

export const useImageResize = ({
  node,
  svgRef,
  zoom,
  pan,
  imageDimensions,
  slotIndex,
  displayEntries,
  onUpdateNode,
  onAutoLayout
}: UseImageResizeProps) => {
  const { isResizing, startResizing, stopResizing } = useResizingState();
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);
  const [localDims, setLocalDims] = useState<{ width: number; height: number } | null>(null);

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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const canvasX = (svgP.x - pan.x) / zoom;
    const canvasY = (svgP.y - pan.y) / zoom;

    setResizeStartPos({ x: canvasX, y: canvasY });
    setResizeStartSize({ width: imageDimensions.width, height: imageDimensions.height });
    setOriginalAspectRatio(imageDimensions.width / (imageDimensions.height || 1));
    startResizing();
  }, [svgRef, zoom, pan, imageDimensions, startResizing]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !svgRef.current) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const canvasX = (svgP.x - pan.x) / zoom;
    const canvasY = (svgP.y - pan.y) / zoom;

    const dx = canvasX - resizeStartPos.x;
    const dy = canvasY - resizeStartPos.y;
    const diag = Math.sqrt(dx * dx + dy * dy);
    const sign = (dx + dy) >= 0 ? 1 : -1;
    const change = sign * diag;
    const newWidth = Math.max(50, resizeStartSize.width + change);
    const newHeight = newWidth / originalAspectRatio;

    setLocalDims({ width: Math.round(newWidth), height: Math.round(newHeight) });
  }, [isResizing, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio]);

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

  // Window event listeners for resize (foreignObject boundary crossing)
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

  return {
    isResizing,
    localDims,
    handleResizePointerDown
  };
};
