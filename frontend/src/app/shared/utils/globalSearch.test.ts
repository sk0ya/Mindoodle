import { describe, expect, it, vi } from 'vitest';
import {
  findNodeByLineNumber,
  getMatchPosition,
  searchFilesForContent,
  searchMultipleMaps,
  searchNodes,
} from './globalSearch';
import type { MindMapData, MindMapNode } from '../types';
import type { StorageAdapter } from '../../core/types/storage.types';

const node = (id: string, text: string, children: MindMapNode[] = [], note?: string): MindMapNode => ({
  id, text, children, note, x: 0, y: 0, fontSize: 14, fontWeight: 'normal'
});

const map = (mapId: string, rootNodes: MindMapNode[]): MindMapData => ({
  title: mapId,
  createdAt: '',
  updatedAt: '',
  mapIdentifier: { mapId, workspaceId: 'ws1' },
  rootNodes,
  settings: { autoSave: true, autoLayout: true, showGrid: true, animationEnabled: true }
});

describe('globalSearch', () => {
  it('searches node text and notes recursively and reports the match type', () => {
    const data = map('map-1', [node('root', 'Roadmap', [node('child', 'Release', [], 'ship it')])]);
    expect(searchNodes('road', data)).toMatchObject([{ nodeId: 'root', matchType: 'text' }]);
    expect(searchNodes('SHIP', data)).toMatchObject([{ nodeId: 'child', matchType: 'note' }]);
    expect(searchNodes('  ', data)).toEqual([]);
    expect(searchMultipleMaps('release', [data, map('map-2', [node('other', 'Release')])])).toHaveLength(2);
  });

  it('finds nodes by zero-based markdown line metadata', () => {
    const data = map('map-1', [node('root', 'Root', [
      node('child', 'Child')
    ])]);
    data.rootNodes[0].markdownMeta = { lineNumber: 0 };
    data.rootNodes[0].children[0].markdownMeta = { lineNumber: 4 };

    expect(findNodeByLineNumber(data, 5)).toEqual({ node: data.rootNodes[0].children[0], depth: 1 });
    expect(findNodeByLineNumber(data, 99)).toBeNull();
  });

  it('normalizes a query before searching file contents', async () => {
    const adapter = {
      loadAllMaps: vi.fn().mockResolvedValue([map('map-1', [node('n', 'Root')])]),
      getMapMarkdown: vi.fn().mockResolvedValue('First line\nAlpha result\nlast')
    };

    const results = await searchFilesForContent('  alpha  ', adapter as unknown as StorageAdapter, [{ id: 'ws1', name: 'Workspace' }]);

    expect(results).toEqual([expect.objectContaining({
      lineNumber: 2,
      lineContent: 'Alpha result',
      filePath: 'Workspace/map-1'
    })]);
  });

  it('returns partial results when a map markdown read fails', async () => {
    const adapter = {
      loadAllMaps: vi.fn().mockResolvedValue([
        map('ok', [node('ok-node', 'ok')]),
        map('broken', [node('broken-node', 'broken')])
      ]),
      getMapMarkdown: vi.fn()
        .mockResolvedValueOnce('contains needle')
        .mockRejectedValueOnce(new Error('read failed'))
    };

    await expect(searchFilesForContent('needle', adapter as unknown as StorageAdapter)).resolves.toHaveLength(1);
  });

  it('splits match text without changing the original casing', () => {
    expect(getMatchPosition('Before Needle After', 'needle')).toEqual({
      beforeMatch: 'Before ', match: 'Needle', afterMatch: ' After'
    });
    expect(getMatchPosition('text', 'missing')).toBeNull();
    expect(getMatchPosition('text', '  ')).toBeNull();
  });
});
