import { describe, expect, it, vi } from 'vitest';
import { normalizeTreeData } from '@core/data/normalizedStore';
import { performNodeSearch, expandSearchResults } from './mapSearch';
import { flattenNodesToOptions, flattenRootNodesToOptions } from './nodeTraversal';
import { pasteNodeTree } from './pasteTree';
import type { MindMapNode } from '@shared/types';

const makeNode = (id: string, text: string, children: MindMapNode[] = [], overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
  ...overrides,
});

describe('node search, traversal, and paste utilities', () => {
  const roots = [makeNode('root-node', 'Project', [
    makeNode('task', 'Important task'),
    makeNode('other', 'Other', [makeNode('deep', 'Deep task')]),
  ])];

  it('searches text and optionally expands ancestors and descendants', () => {
    const data = normalizeTreeData(roots);
    expect(performNodeSearch('IMPORTANT', data)).toEqual({
      matchingNodes: new Set(['task']),
      highlightedNodes: new Set(['task', 'root-node']),
    });
    expect(performNodeSearch('task', data, { includeAncestors: false, includeDescendants: true }).highlightedNodes)
      .toEqual(new Set(['task', 'deep']));
    expect(performNodeSearch('missing', data)).toEqual({ matchingNodes: new Set(), highlightedNodes: new Set() });
    expect(performNodeSearch('task', null)).toEqual({ matchingNodes: new Set(), highlightedNodes: new Set() });
    expect(expandSearchResults(new Set(['root-node']), data, false, true)).toEqual(new Set(['root-node', 'task', 'other', 'deep']));

    const reservedRootData = normalizeTreeData([makeNode('root', 'Project', [makeNode('task', 'Important task')])]);
    expect(performNodeSearch('important', reservedRootData).highlightedNodes).toEqual(new Set(['task', 'root']));
  });

  it('flattens nodes with stable anchor labels and map IDs', () => {
    expect(flattenNodesToOptions(roots[0], 'map-1').map(item => ({ id: item.id, anchorText: item.anchorText, mapId: item.mapId })))
      .toEqual([
        { id: 'root-node', anchorText: 'Project', mapId: 'map-1' },
        { id: 'task', anchorText: 'Important task', mapId: 'map-1' },
        { id: 'other', anchorText: 'Other', mapId: 'map-1' },
        { id: 'deep', anchorText: 'Deep task', mapId: 'map-1' },
      ]);
    expect(flattenRootNodesToOptions(roots)).toHaveLength(4);
  });

  it('pastes a complete tree, copies presentation fields, and stops on failed insertion', () => {
    const source = makeNode('source', 'Source', [makeNode('child', 'Child')], {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#f00',
      collapsed: true,
      note: 'note',
    });
    let next = 0;
    const added: Array<{ id: string; parentId: string; text: string }> = [];
    const addChild = vi.fn((parentId: string, text: string) => {
      const id = `new-${next++}`;
      added.push({ id, parentId, text });
      return id;
    });
    const update = vi.fn();
    expect(pasteNodeTree(source, 'parent', addChild, update)).toBe('new-0');
    expect(added).toEqual([
      { id: 'new-0', parentId: 'parent', text: 'Source' },
      { id: 'new-1', parentId: 'new-0', text: 'Child' },
    ]);
    expect(update).toHaveBeenCalledWith('new-0', expect.objectContaining({ fontSize: 22, color: '#f00', collapsed: false }));

    expect(pasteNodeTree(source, 'parent', vi.fn(() => undefined), update)).toBeUndefined();
  });
});
