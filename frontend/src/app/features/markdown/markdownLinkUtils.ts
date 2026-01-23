import type { NodeLink, MindMapNode } from '@shared/types';
import { generateUrlId } from '@shared/utils';








type MdLink = { label: string; href: string; index: number };

// Parse markdown links [label](href) in a single pass without regex backtracking
function parseMarkdownLinks(note: string): MdLink[] {
  const out: MdLink[] = [];
  let i = 0;
  while (i < note.length) {
    const lb = note.indexOf('[', i);
    if (lb === -1) break;
    const rb = note.indexOf(']', lb + 1);
    if (rb === -1) break;
    if (note[rb + 1] !== '(') { i = rb + 1; continue; }
    const lp = rb + 1; // at '('
    const rp = note.indexOf(')', lp + 1);
    if (rp === -1) break;
    const label = note.slice(lb + 1, rb);
    const hrefRaw = note.slice(lp + 1, rp).trim();
    out.push({ label: label.trim(), href: hrefRaw, index: lb });
    i = rp + 1;
  }
  return out;
}

export function extractNodeLinksFromMarkdown(note: string | undefined, currentMapId?: string): NodeLink[] {
  if (!note || !note.trim()) return [];
  const links: NodeLink[] = [];
  const seen = new Set<string>();

  const md = parseMarkdownLinks(note);
  for (const item of md) {
    const rawHref = item.href;
    let targetMapId: string | undefined;
    let targetNodeId: string | undefined;

    
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
        
        if (m || n) {
          targetMapId = m || currentMapId;
          targetNodeId = n || undefined;
        }
      } catch {
        
      }
    }

    if (targetMapId || targetNodeId) {
      const key = `${targetMapId || ''}|${targetNodeId || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({
          id: key, 
          targetMapId,
          targetNodeId,
        });
      }
    }
  }

  return links;
}



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
    const node = stack.pop();
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
  // Parse suffix like "-<number>" without regex backtracking
  let base = anchorText;
  let index = 0;
  const dash = anchorText.lastIndexOf('-');
  if (dash > 0 && dash + 1 < anchorText.length) {
    const num = anchorText.slice(dash + 1);
    if (/^\d+$/.test(num)) {
      base = anchorText.slice(0, dash);
      index = parseInt(num, 10);
    }
  }
  if (!Number.isFinite(index) || index < 0) return null;

  let count = 0;
  const queue: MindMapNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (node.text === base) {
      if (count === index) return node;
      count += 1;
    }
    if (node.children && node.children.length) queue.push(...node.children);
  }
  return null;
}

// Re-export from shared utils to maintain backward compatibility
export { computeAnchorForNode } from '@shared/utils/nodeAnchor';

// Extract links that point to nodes in the same map by node text.
// Supported href patterns:
// - #<node text>
// - node:<node text>
export function extractInternalNodeLinksFromMarkdown(note: string | undefined, rootNode?: MindMapNode): NodeLink[] {
  if (!note || !note.trim() || !rootNode) return [];
  const results: NodeLink[] = [];
  const seenNodeIds = new Set<string>();

  const md = parseMarkdownLinks(note);
  for (const item of md) {
    const rawHref = item.href;
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
      });
    }
  }

  return results;
}

// Lightweight presence check for internal markdown links without resolving nodes.
export function hasInternalMarkdownLinks(note: string | undefined): boolean {
  if (!note || !note.trim()) return false;
  const md = parseMarkdownLinks(note);
  return md.some(l => l.href.startsWith('#') || /^node:/i.test(l.href));
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

  const md = parseMarkdownLinks(note);
  for (const { label, href } of md) {

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
  const md = parseMarkdownLinks(note);
  for (const l of md) out.push(l);

  // Extract plain URLs (http://, https://) not inside markdown links
  const lower = note.toLowerCase();
  let i = 0;
  while (i < note.length) {
    const h = lower.indexOf('http://', i);
    const s = lower.indexOf('https://', i);
    let idx = -1;
    if (h === -1) idx = s; else if (s === -1) idx = h; else idx = Math.min(h, s);
    if (idx === -1) break;
    // ensure not preceded by '](' (markdown link)
    const prev2 = note.slice(Math.max(0, idx - 2), idx);
    if (prev2 !== '](') {
      let j = idx + (lower.startsWith('https://', idx) ? 8 : 7);
      while (j < note.length) {
        const ch = note[j];
        if (/\s/.test(ch) || '<>"{}|\\^`[]'.includes(ch)) break;
        j++;
      }
      out.push({ label: note.slice(idx, j), href: note.slice(idx, j), index: idx });
      i = j;
      continue;
    }
    i = idx + 1;
  }

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
    // Absolute protocols: not eligible (avoid regex)
    const hasScheme = (() => {
      const i = trimmed.indexOf('://');
      if (i <= 0) return false;
      for (let k = 0; k < i; k++) {
        const c = trimmed.charCodeAt(k);
        const isAlpha = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
        if (!isAlpha) return false;
      }
      return true;
    })();
    const lower = trimmed.toLowerCase();
    if (hasScheme || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('file:')) return null;

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
    const removeLeading = (s: string) => {
      if (s.startsWith('./')) return s.slice(2);
      if (s.startsWith('/')) return s.slice(1);
      return s;
    };
    const removeTrailingSlashes = (s: string) => {
      let end = s.length;
      while (end > 0 && s[end - 1] === '/') end--;
      return s.slice(0, end);
    };
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
      const lastLower = last.toLowerCase();
      segs[segs.length - 1] = lastLower.endsWith('.md') ? last.slice(0, last.length - 3) : last;
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

  const md = parseMarkdownLinks(note);
  for (const { label, href } of md) {

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
