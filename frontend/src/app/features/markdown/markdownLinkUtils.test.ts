import { describe, expect, it } from 'vitest';
import {
  extractAllMarkdownLinksDetailed,
  extractExternalLinksFromMarkdown,
  extractInternalMarkdownLinksDetailed,
  extractInternalNodeLinksFromMarkdown,
  extractNodeLinksFromMarkdown,
  hasInternalMarkdownLinks,
  resolveAnchorToNode,
  resolveHrefToMapTarget,
} from './markdownLinkUtils';
import type { MindMapNode } from '@shared/types';

const makeNode = (id: string, text: string, children: MindMapNode[] = []): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
});

describe('markdown link utilities', () => {
  const root = makeNode('root', 'Root', [
    makeNode('one', 'Topic'),
    makeNode('two', 'Topic'),
    makeNode('three', 'Other'),
  ]);

  it('extracts node, hash, map, and URL query targets while deduplicating', () => {
    const note = '[one](node:one) [same](#one) [map](map:map-2#node-2) [url](?mapId=map-3&nodeId=node-3) [dup](node:one)';
    expect(extractNodeLinksFromMarkdown(note, 'map-1')).toEqual([
      { id: 'map-1|one', targetMapId: 'map-1', targetNodeId: 'one' },
      { id: 'map-2|node-2', targetMapId: 'map-2', targetNodeId: 'node-2' },
      { id: 'map-3|node-3', targetMapId: 'map-3', targetNodeId: 'node-3' },
    ]);
    expect(extractNodeLinksFromMarkdown(undefined)).toEqual([]);
  });

  it('resolves duplicate anchors by occurrence suffix in breadth-first order', () => {
    expect(resolveAnchorToNode(root, 'Topic')?.id).toBe('one');
    expect(resolveAnchorToNode(root, 'Topic-1')?.id).toBe('two');
    expect(resolveAnchorToNode(root, 'Topic-2')).toBeNull();
    expect(resolveAnchorToNode(root, '')).toBeNull();
  });

  it('extracts internal links and ignores external links for internal APIs', () => {
    const note = '[first](#Topic) [second](node:Other) [external](https://example.test) [first again](#Topic)';
    expect(hasInternalMarkdownLinks(note)).toBe(true);
    expect(extractInternalNodeLinksFromMarkdown(note, root)).toEqual([
      { id: 'md|one', targetNodeId: 'one' },
      { id: 'md|three', targetNodeId: 'three' },
    ]);
    expect(extractInternalMarkdownLinksDetailed(note, root)).toEqual([
      { id: 'int|first|Topic|one', label: 'first', anchorText: 'Topic', nodeId: 'one' },
      { id: 'int|second|Other|three', label: 'second', anchorText: 'Other', nodeId: 'three' },
      { id: 'int|first again|Topic|one', label: 'first again', anchorText: 'Topic', nodeId: 'one' },
    ]);
    expect(hasInternalMarkdownLinks('[external](https://example.test)')).toBe(false);
  });

  it('extracts external markdown links and plain URLs in source order', () => {
    const note = 'See https://plain.test/a and [site](https://site.test) then [mail](mailto:a@example.test).';
    const detailed = extractAllMarkdownLinksDetailed(note);
    expect(detailed.map(link => link.href)).toEqual([
      'https://plain.test/a',
      'https://site.test',
      'mailto:a@example.test',
    ]);
    const external = extractExternalLinksFromMarkdown(note);
    expect(external.map(link => ({ href: link.href, label: link.label }))).toEqual([
      { href: 'https://site.test', label: 'site' },
      { href: 'mailto:a@example.test', label: 'mail' },
    ]);
    expect(new Set(external.map(link => link.id)).size).toBe(2);
  });

  it('resolves relative map paths, extensions, anchors, and special protocols', () => {
    const ids = ['docs/main', 'docs/README', 'other/map'];
    expect(resolveHrefToMapTarget('#Topic', 'docs/current', ids)).toEqual({ mapId: 'docs/current', anchorText: 'Topic' });
    expect(resolveHrefToMapTarget('../main.md#Topic%20A', 'docs/sub/current', ids)).toEqual({ mapId: 'docs/main', anchorText: 'Topic A' });
    expect(resolveHrefToMapTarget('other/', 'current', ids)).toEqual({ mapId: 'other/map' });
    expect(resolveHrefToMapTarget('https://example.test/docs/main', 'docs/current', ids)).toBeNull();
    expect(resolveHrefToMapTarget('mailto:test@example.com', 'docs/current', ids)).toBeNull();
    expect(resolveHrefToMapTarget('missing', 'docs/current', ids)).toBeNull();
  });
});
