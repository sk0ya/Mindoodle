import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { MarkdownConversionService } from './MarkdownConversionService';
import { MapOperationsService } from './MapOperationsService';
import { PathResolutionService } from './PathResolutionService';

const node = (id: string, text: string, children: MindMapNode[] = [], lineNumber?: number): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
  markdownMeta: lineNumber === undefined ? undefined : { lineNumber, type: 'heading', level: 1 },
});

describe('mindmap service utilities', () => {
  it('resolves categories, titles, and relative paths', () => {
    expect(PathResolutionService.extractCategory('folder/sub/map')).toBe('folder/sub');
    expect(PathResolutionService.extractCategory('map')).toBe('');
    expect(PathResolutionService.parseTitleAndCategory('/folder/map')).toEqual({ title: 'map', category: 'folder' });
    expect(PathResolutionService.parseTitleAndCategory('map', 'existing')).toEqual({ title: 'map', category: 'existing' });
    expect(PathResolutionService.resolvePath('folder/current.md', '../other.md')).toBe('other.md');
    expect(PathResolutionService.resolvePath('folder/current.md', './sub/other.md')).toBe('folder/sub/other.md');
    expect(PathResolutionService.resolvePath('folder/current.md', '/root.md')).toBe('root.md');
  });

  it('creates and locates map data by full identifier', () => {
    const root = node('root', 'Root');
    const data = MapOperationsService.createMapData('folder/map', 'ws_1', [root], '2026-01-01');
    expect(data).toMatchObject({ title: 'folder/map', category: 'folder', mapIdentifier: { mapId: 'folder/map', workspaceId: 'ws_1' } });
    expect(MapOperationsService.isCurrentMap(data, data.mapIdentifier)).toBe(true);
    expect(MapOperationsService.isCurrentMap(data, { mapId: 'map', workspaceId: 'ws_1' })).toBe(false);
    expect(MapOperationsService.findMapByIdentifier([data], data.mapIdentifier)).toBe(data);
    expect(MapOperationsService.findMapByIdentifier([], data.mapIdentifier)).toBeUndefined();
    expect(MapOperationsService.extractWorkspaceId('/ws_1/folder/map')).toBe('ws_1');
    expect(MapOperationsService.extractWorkspaceId('/local/map')).toBeNull();
  });

  it('flattens nodes, compares structure, and maps markdown lines', () => {
    const roots = [node('root', 'Root', [node('child', 'Child', [], 3)], 0)];
    const flat = MarkdownConversionService.flattenNodes(roots);
    expect(flat.map(item => item.id)).toEqual(['root', 'child']);
    expect(MarkdownConversionService.checkStructureMatch(flat, MarkdownConversionService.flattenNodes(roots))).toBe(true);
    expect(MarkdownConversionService.checkStructureMatch(flat, [{ text: 'root', t: 'heading', lvl: 2 }])).toBe(false);
    expect(MarkdownConversionService.buildLineMapping(roots)).toEqual({
      lineToNode: { 1: 'root', 4: 'child' },
      nodeToLine: { root: 1, child: 4 },
    });
    expect(MarkdownConversionService.getNodeIdByLine({ 3: 'child', 10: 'later' }, 5)).toBe('child');
    expect(MarkdownConversionService.getNodeIdByLine({ 3: 'child' }, 2)).toBeNull();
  });
});
