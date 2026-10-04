import { describe, expect, it } from 'vitest';
import type { MapSummary } from '@core/types';
import type { MindMapData } from '@shared/types';
import { hasLoadedTree, mergeSummariesIntoMapList, sameExplorerTree, sameMapList } from './MapListService';

const summary = (mapId: string, updatedAt = '2026-01-01T00:00:00.000Z', title = mapId): MapSummary => ({
  mapIdentifier: { mapId, workspaceId: 'cloud' },
  title,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
});

describe('MapListService', () => {
  it('builds body-less entries from a listing', () => {
    const [entry] = mergeSummariesIntoMapList([], [summary('A')]);

    expect(entry.mapIdentifier).toEqual({ mapId: 'A', workspaceId: 'cloud' });
    expect(entry.rootNodes).toEqual([]);
    expect(hasLoadedTree(entry)).toBe(false);
  });

  it('reuses unchanged entries, so an idle refresh yields an equal list', () => {
    const first = mergeSummariesIntoMapList([], [summary('A'), summary('B')]);
    const second = mergeSummariesIntoMapList(first, [summary('A'), summary('B')]);

    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(sameMapList(first, second)).toBe(true);
  });

  it('notices a new version, a new title, an added and a removed map', () => {
    const base = mergeSummariesIntoMapList([], [summary('A'), summary('B')]);

    expect(sameMapList(base, mergeSummariesIntoMapList(base, [summary('A', '2026-02-01T00:00:00.000Z'), summary('B')]))).toBe(false);
    expect(sameMapList(base, mergeSummariesIntoMapList(base, [summary('A', undefined, 'Renamed'), summary('B')]))).toBe(false);
    expect(sameMapList(base, mergeSummariesIntoMapList(base, [summary('A'), summary('B'), summary('C')]))).toBe(false);
    expect(sameMapList(base, mergeSummariesIntoMapList(base, [summary('A')]))).toBe(false);
  });

  it('keeps a tree attached to an entry while its version is unchanged', () => {
    const [entry] = mergeSummariesIntoMapList([], [summary('A')]);
    const withTree: MindMapData = { ...entry, rootNodes: [{ id: 'n', text: 'A', x: 0, y: 0, children: [], fontSize: 14, fontWeight: 'normal' }] };

    const [kept] = mergeSummariesIntoMapList([withTree], [summary('A')]);

    expect(kept).toBe(withTree);
    expect(hasLoadedTree(kept)).toBe(true);
  });

  it('compares explorer trees structurally', () => {
    const tree = () => ({ type: 'folder' as const, name: 'root', path: '/', children: [{ type: 'file' as const, name: 'a.md', path: '/a.md', isMarkdown: true }] });

    expect(sameExplorerTree(tree(), tree())).toBe(true);
    expect(sameExplorerTree(tree(), { ...tree(), children: [] })).toBe(false);
    expect(sameExplorerTree(null, tree())).toBe(false);
  });
});
