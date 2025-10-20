/**
 * Display entry types representing visual content in markdown
 */
export type DisplayEntry =
  | { kind: 'image'; subType: 'md' | 'html'; url: string; tag: string; start: number; end: number }
  | { kind: 'mermaid'; code: string; start: number; end: number };

/**
 * Extract display entries (images and mermaid diagrams) from text
 *
 * @param note - Markdown/HTML text to extract from
 * @returns Array of display entries sorted by position
 */
export const extractDisplayEntries = (note?: string): DisplayEntry[] => {
  if (!note) return [];

  const entries: DisplayEntry[] = [
    ...extractMermaidBlocks(note),
    ...extractMarkdownImages(note),
    ...extractHtmlImages(note)
  ];

  entries.sort((a, b) => a.start - b.start);
  return entries;
};

/**
 * Extract mermaid code blocks: ```mermaid ... ```
 */
const extractMermaidBlocks = (note: string): DisplayEntry[] => {
  const entries: DisplayEntry[] = [];
  let idx = 0;

  while (idx < note.length) {
    const start = note.indexOf('```mermaid', idx);
    if (start === -1) break;

    const endFence = note.indexOf('```', start + 10);
    if (endFence === -1) break;

    const end = endFence + 3;
    const code = note.slice(start, end);
    entries.push({ kind: 'mermaid', code, start, end });
    idx = end;
  }

  return entries;
};

/**
 * Extract markdown image syntax: ![alt](url)
 */
const extractMarkdownImages = (note: string): DisplayEntry[] => {
  const entries: DisplayEntry[] = [];
  let idx = 0;

  while (idx < note.length) {
    const bang = note.indexOf('![', idx);
    if (bang === -1) break;

    const rbracket = note.indexOf('](', bang + 2);
    if (rbracket === -1) {
      idx = bang + 2;
      continue;
    }

    const close = note.indexOf(')', rbracket + 2);
    if (close === -1) {
      idx = rbracket + 2;
      continue;
    }

    const full = note.slice(bang, close + 1);
    const raw = note.slice(rbracket + 2, close).trim();
    const url = raw.split(/\s+/)[0];

    entries.push({
      kind: 'image',
      subType: 'md',
      url,
      tag: full,
      start: bang,
      end: close + 1
    });

    idx = close + 1;
  }

  return entries;
};

/**
 * Extract HTML image tags: <img ... src="..." ...>
 */
const extractHtmlImages = (note: string): DisplayEntry[] => {
  const entries: DisplayEntry[] = [];
  const lower = note.toLowerCase();
  let idx = 0;

  while (idx < note.length) {
    const tagStart = lower.indexOf('<img', idx);
    if (tagStart === -1) break;

    const tagEnd = note.indexOf('>', tagStart + 4);
    const tag = tagEnd !== -1
      ? note.slice(tagStart, tagEnd + 1)
      : note.slice(tagStart);

    const url = extractSrcAttribute(tag);
    if (url) {
      entries.push({
        kind: 'image',
        subType: 'html',
        url,
        tag,
        start: tagStart,
        end: tagStart + tag.length
      });
    }

    idx = tagEnd === -1 ? tagStart + 4 : tagEnd + 1;
  }

  return entries;
};

/**
 * Extract src attribute value from HTML tag
 */
const extractSrcAttribute = (tag: string): string | null => {
  const srcPos = tag.toLowerCase().indexOf('src=');
  if (srcPos === -1) return null;

  const rest = tag.slice(srcPos + 4).trim();
  const quote = rest[0];

  if (quote === '"' || quote === "'") {
    const qEnd = rest.indexOf(quote, 1);
    return qEnd > 0 ? rest.slice(1, qEnd) : null;
  }

  // Unquoted attribute
  const sp = rest.search(/[\s>]/);
  return sp > 0 ? rest.slice(0, sp) : rest;
};
