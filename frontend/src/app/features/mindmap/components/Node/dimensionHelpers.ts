import type { MindMapNode } from '@shared/types';
import type { DisplayEntry } from './nodeRendererHelpers';

export const parseImageDimensions = (entry: DisplayEntry, _index: number): { width: number; height: number } | null => {
  if (entry.kind !== 'image' || entry.subType !== 'html') return null;

  const wMatch = /\swidth=["']?(\d+)(?:px)?["']?/i.exec(entry.tag);
  const hMatch = /\sheight=["']?(\d+)(?:px)?["']?/i.exec(entry.tag);

  if (!wMatch || !hMatch) return null;

  const w = parseInt(wMatch[1], 10);
  const h = parseInt(hMatch[1], 10);

  return (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) ? { width: w, height: h } : null;
};

export const calculateImageDimensions = (
  node: MindMapNode,
  noteSize: { width: number; height: number } | null,
  nodeWidth: number,
  imageHeight: number
) => {
  const customDims = node.customImageWidth && node.customImageHeight
    ? { width: node.customImageWidth, height: node.customImageHeight }
    : noteSize || { width: 150, height: 105 };

  return node.kind === 'table'
    ? { width: node.customImageWidth ?? Math.max(50, nodeWidth - 10), height: node.customImageHeight ?? imageHeight }
    : customDims;
};

export const calculateImagePosition = (
  node: MindMapNode,
  renderDims: { width: number; height: number },
  nodeHeight: number
) => ({
  x: node.x - renderDims.width / 2,
  y: node.kind === 'table'
    ? node.y - renderDims.height / 2
    : node.y - nodeHeight / 2 + 4
});

export const constrainDimensions = (width: number, _height: number, aspectRatio: number) => {
  const MIN_WIDTH = 50;
  const MAX_WIDTH = 400;
  const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  const newHeight = newWidth / aspectRatio;
  return { width: Math.round(newWidth), height: Math.round(newHeight) };
};

export const getEntryKey = (entry?: DisplayEntry): string => {
  if (!entry) return 'none';
  if (entry.kind === 'image') return `img:${entry.url}`;
  if (entry.kind === 'mermaid') {
    const code = entry.code || '';
    return `mmd:${code.length}:${code.slice(0, 50)}`;
  }
  return 'none';
};

export const updateImageDimensionsInNote = (
  note: string | undefined,
  entry: DisplayEntry,
  width: number,
  height: number
): string | undefined => {
  if (!note || entry.kind !== 'image') return note;

  const w = Math.round(width);
  const h = Math.round(height);

  const replacement = entry.subType === 'html'
    ? entry.tag
        .replace(/\swidth=["']?\d+(?:px)?["']?/ig, '')
        .replace(/\sheight=["']?\d+(?:px)?["']?/ig, '')
        .replace(/<img([^>]*)>/i, (_m, attrs: string) => `<img${attrs} width="${w}" height="${h}">`)
    : `<img src="${entry.url}" width="${w}" height="${h}">`;

  return note.slice(0, entry.start) + replacement + note.slice(entry.end);
};
