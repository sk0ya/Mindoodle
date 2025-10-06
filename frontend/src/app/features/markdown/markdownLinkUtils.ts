import type { NodeLink } from '@shared/types';
import { generateUrlId } from '@shared/utils';

// Extract NodeLink objects from markdown note content.
// Supported href patterns:
// - node:<nodeId>
// - #<nodeId>
// - map:<mapId>
// - map:<mapId>#<nodeId>
// - URLs/paths with ?mapId=...&nodeId=...
export function extractNodeLinksFromMarkdown(note: string | undefined, currentMapId?: string): NodeLink[] {
  if (!note || !note.trim()) return [];

  const links: NodeLink[] = [];
  const seen = new Set<string>();

  // Basic markdown link matcher: [text](href)
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(note)) !== null) {
    const rawHref = match[1].trim();
    let targetMapId: string | undefined;
    let targetNodeId: string | undefined;

    // node:<nodeId>
    if (/^node:/i.test(rawHref)) {
      targetMapId = currentMapId;
      targetNodeId = rawHref.replace(/^node:/i, '');
    }
    // #<nodeId>
    else if (/^#/.test(rawHref)) {
      targetMapId = currentMapId;
      targetNodeId = rawHref.slice(1);
    }
    // map:<mapId>#<nodeId?>
    else if (/^map:/i.test(rawHref)) {
      const rest = rawHref.replace(/^map:/i, '');
      const [map, hash] = rest.split('#');
      targetMapId = map || undefined;
      targetNodeId = hash || undefined;
    }
    else {
      // Try parsing as URL or path with query params
      try {
        // Allow relative paths and query-only strings
        const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const url = rawHref.startsWith('http') || rawHref.startsWith('file:')
          ? new URL(rawHref)
          : new URL(rawHref, base);

        const m = url.searchParams.get('mapId') || undefined;
        const n = url.searchParams.get('nodeId') || undefined;
        // If either exists, treat as internal link
        if (m || n) {
          targetMapId = m || currentMapId;
          targetNodeId = n || undefined;
        }
      } catch {
        // Not a URL; ignore
      }
    }

    if (targetMapId || targetNodeId) {
      const key = `${targetMapId || ''}|${targetNodeId || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({
          id: key, // stable enough for derived list usage
          targetMapId,
          targetNodeId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  return links;
}

// ---------------- New internal-only link extraction (mapId/nodeId abolished) ----------------
import type { MindMapNode } from '@shared/types';

function slugify(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function findNodeByText(root: MindMapNode, target: string): MindMapNode | null {
  const targetSlug = slugify(target);
  const stack: MindMapNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (!node) continue;
    if (node.text === target) return node;
    if (slugify(node.text) === targetSlug) return node;
    if (node.children && node.children.length) stack.push(...node.children);
  }
  return null;
}

// Resolve anchors like "テキスト" (first occurrence) or "テキスト-1" (second), "テキスト-2" (third), ...
export function resolveAnchorToNode(root: MindMapNode, anchorText: string): MindMapNode | null {
  if (!root || !anchorText) return null;
  const m = anchorText.match(/^(.*?)-(\d+)$/);
  const base = m ? m[1] : anchorText;
  const index = m ? parseInt(m[2], 10) : 0;
  if (!Number.isFinite(index) || index < 0) return null;

  let count = 0;
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    if (!node) continue;
    if (node.text === base) {
      if (count === index) return node;
      count += 1;
    }
    if (node.children && node.children.length) queue.push(...node.children);
  }
  return null;
}

// Compute anchor string for a specific node based on duplicate order.
// First occurrence => "Text", second => "Text-1", third => "Text-2", ...
export function computeAnchorForNode(root: MindMapNode, targetNodeId: string): string | null {
  if (!root || !targetNodeId) return null;
  let index = 0;
  let targetText: string | null = null;
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    if (!node) continue;
    if (node.id === targetNodeId) {
      targetText = node.text || '';
      break;
    }
    if (node.children && node.children.length) queue.push(...node.children);
  }
  if (targetText === null) return null;
  // Count occurrences until the target node is reached again in a second pass
  let count = 0;
  const queue2: MindMapNode[] = [root];
  while (queue2.length) {
    const node = queue2.shift()!;
    if (!node) continue;
    if (node.text === targetText) {
      if (node.id === targetNodeId) { index = count; break; }
      count += 1;
    }
    if (node.children && node.children.length) queue2.push(...node.children);
  }
  return index === 0 ? targetText : `${targetText}-${index}`;
}

// Extract links that point to nodes in the same map by node text.
// Supported href patterns:
// - #<node text>
// - node:<node text>
export function extractInternalNodeLinksFromMarkdown(note: string | undefined, rootNode?: MindMapNode): NodeLink[] {
  if (!note || !note.trim() || !rootNode) return [];

  const results: NodeLink[] = [];
  const seenNodeIds = new Set<string>();

  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(note)) !== null) {
    const rawHref = match[1].trim();
    let anchor: string | null = null;

    if (/^#/.test(rawHref)) {
      anchor = rawHref.slice(1);
    } else if (/^node:/i.test(rawHref)) {
      anchor = rawHref.replace(/^node:/i, '');
    } else {
      // other forms (mapId/nodeId, external URLs) are ignored per new policy
      continue;
    }

    const target = findNodeByText(rootNode, anchor);
    if (target && !seenNodeIds.has(target.id)) {
      seenNodeIds.add(target.id);
      results.push({
        id: `md|${target.id}`,
        targetNodeId: target.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  return results;
}

// Lightweight presence check for internal markdown links without resolving nodes.
export function hasInternalMarkdownLinks(note: string | undefined): boolean {
  if (!note || !note.trim()) return false;
  return /\[[^\]]+\]\(#.+\)/.test(note) || /\[[^\]]+\]\(node:.+\)/i.test(note);
}

// External link extraction for displaying and navigation
export interface ExternalMarkdownLink {
  id: string;
  href: string;
  label: string;
}

export function extractExternalLinksFromMarkdown(note: string | undefined): ExternalMarkdownLink[] {
  if (!note || !note.trim()) return [];
  const results: ExternalMarkdownLink[] = [];
  const seen = new Set<string>();

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(note)) !== null) {
    const label = m[1].trim();
    const href = m[2].trim();

    // Skip internal forms handled elsewhere
    if (/^#/.test(href)) continue;
    if (/^node:/i.test(href)) continue;

    // Treat anything else as external (http, https, mailto, tel, file, relative, absolute path)
    const key = `${label}|${href}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ id: generateUrlId(), href, label });
    }
  }

  return results;
}

// Parse all markdown links in appearance order
export interface ParsedMarkdownLink {
  label: string;
  href: string;
  index: number; // position in original note for ordering
}

export function extractAllMarkdownLinksDetailed(note: string | undefined): ParsedMarkdownLink[] {
  if (!note || !note.trim()) return [];
  const out: ParsedMarkdownLink[] = [];

  // Extract markdown-style links [text](url)
  const mdRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(note)) !== null) {
    out.push({ label: m[1].trim(), href: m[2].trim(), index: m.index });
  }

  // Extract plain URLs (http://, https://)
  // Match URLs that are NOT inside markdown link syntax [text](url)
  // We check if the URL is preceded by ]( to skip markdown link URLs
  const urlRe = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRe.exec(note)) !== null) {
    const url = urlMatch[0];
    const matchIndex = urlMatch.index;

    // Check if this URL is inside markdown link syntax by looking backwards
    const precedingText = note.slice(Math.max(0, matchIndex - 2), matchIndex);
    const isInsideMarkdownLink = precedingText === '](';

    if (!isInsideMarkdownLink) {
      out.push({ label: url, href: url, index: matchIndex });
    }
  }

  // Sort by appearance order
  out.sort((a, b) => a.index - b.index);

  return out;
}

// Resolve a relative markdown href to a known mapId and optional anchor text
export function resolveHrefToMapTarget(
  href: string,
  currentMapId: string,
  availableMapIds: string[]
): { mapId: string; anchorText?: string } | null {
  try {
    const trimmed = href.trim();
    // Absolute protocols: not eligible
    if (/^[a-zA-Z]+:\/\//.test(trimmed) || /^(mailto:|tel:|file:)/i.test(trimmed)) return null;

    // Split off hash and query
    const hashIndex = trimmed.indexOf('#');
    const qIndex = trimmed.indexOf('?');
    const cutIndex = (i: number) => (i >= 0 ? i : Infinity);
    const endIndex = Math.min(cutIndex(hashIndex), cutIndex(qIndex));
    const pathPart = endIndex === Infinity ? trimmed : trimmed.slice(0, endIndex);
    const anchorText = hashIndex >= 0 ? decodeURIComponent(trimmed.slice(hashIndex + 1)) : undefined;

    // If no path (e.g. just "#anchor"), target current map
    if (!pathPart || pathPart === '' || pathPart === '#') {
      return { mapId: currentMapId, anchorText };
    }

    // Normalize path
    const removeLeading = (s: string) => s.replace(/^\.\//, '').replace(/^\//, '');
    const removeTrailingSlashes = (s: string) => s.replace(/\/+$/,'');
    const normalizeSegments = (segs: string[]) => {
      const out: string[] = [];
      for (const s of segs) {
        if (s === '' || s === '.') continue;
        if (s === '..') { out.pop(); continue; }
        out.push(s);
      }
      return out;
    };

    const dirOf = (id: string) => {
      const i = id.lastIndexOf('/');
      return i >= 0 ? id.slice(0, i) : '';
    };

    const baseDir = dirOf(currentMapId);
    // Clean raw path and drop trailing slashes (e.g., "cc.md/" -> "cc.md")
    const raw = removeTrailingSlashes(removeLeading(pathPart));
    // Split and remove .md only from the last segment
    const segs = raw.split('/');
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      segs[segs.length - 1] = last.replace(/\.md$/i, '');
    }
    const strippedMd = segs.join('/');

    const baseSegs = baseDir ? baseDir.split('/') : [];
    const targetSegs = normalizeSegments([...baseSegs, ...strippedMd.split('/')]);
    const candidate = targetSegs.join('/');

    const tryIds = [
      candidate,
      `${candidate}/README`,
      `${candidate}/map`
    ];
    const found = tryIds.find(id => availableMapIds.includes(id));
    if (found) return { mapId: found, anchorText };
  } catch {
    // ignore
  }
  return null;
}

// Detailed internal markdown links with label and anchor text
export interface InternalMarkdownLink {
  id: string;
  label: string;
  anchorText: string;
  nodeId?: string; // resolved node id if found
}

export function extractInternalMarkdownLinksDetailed(note: string | undefined, rootNode?: MindMapNode): InternalMarkdownLink[] {
  if (!note || !note.trim()) return [];
  const results: InternalMarkdownLink[] = [];
  const seen = new Set<string>();

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(note)) !== null) {
    const label = m[1].trim();
    const href = m[2].trim();

    let anchor: string | null = null;
    if (/^#/.test(href)) anchor = href.slice(1);
    else if (/^node:/i.test(href)) anchor = href.replace(/^node:/i, '');
    if (!anchor) continue;

    let resolvedId: string | undefined;
    if (rootNode) {
      const nodeByAnchor = resolveAnchorToNode(rootNode, anchor);
      if (nodeByAnchor) resolvedId = nodeByAnchor.id;
      else {
        const node = findNodeByText(rootNode, anchor);
        if (node) resolvedId = node.id;
      }
    }

    const key = `int|${label}|${anchor}|${resolvedId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ id: key, label, anchorText: anchor, nodeId: resolvedId });
  }
  return results;
}
