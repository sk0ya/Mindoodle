import { LineEndingUtils } from '@shared/utils/lineEndingUtils';
import type { FileAttachment } from '@shared/types';

/**
 * Parse table from markdown string
 */
export const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
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

/**
 * Display entry types
 */
export type DisplayEntry =
  | { kind: 'image'; subType: 'md' | 'html'; url: string; tag: string; start: number; end: number }
  | { kind: 'mermaid'; code: string; start: number; end: number };

/**
 * Extract display entries (images and mermaid diagrams) from text
 */
export const extractDisplayEntries = (note?: string): DisplayEntry[] => {
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

/**
 * Check if path is relative local path
 */
export const isRelativeLocalPath = (path: string): boolean => {
  if (/^(https?:|data:|blob:)/i.test(path)) return false;
  return path.startsWith('./') || path.startsWith('../') || (!path.includes('://') && !path.startsWith('/'));
};

/**
 * Convert display entries to file attachments
 */
export const displayEntriesToFileAttachments = (
  entries: DisplayEntry[],
  nodeId: string
): FileAttachment[] => {
  const imageEntries = entries.filter((e): e is Extract<DisplayEntry, { kind: 'image' }> => e.kind === 'image');

  return imageEntries.map((e, i) => ({
    id: `noteimg-${nodeId}-${i}`,
    name: (e.url.split('/').pop() || `image-${i}`),
    type: 'image/*',
    size: 0,
    isImage: true,
    createdAt: new Date().toISOString(),
    downloadUrl: e.url,
    isRelativeLocal: isRelativeLocalPath(e.url)
  } as FileAttachment & { isRelativeLocal?: boolean }));
};
