import { describe, expect, it } from 'vitest';
import type { MindMapData, MindMapNode } from '@shared/types';
import { FileOperationsService } from './FileOperationsService';

const rootNode: MindMapNode = {
  id: 'root',
  text: 'Root',
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children: [],
};

const mapData: MindMapData = {
  title: 'Map',
  category: 'folder',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  mapIdentifier: { mapId: 'folder/map', workspaceId: 'ws-1' },
  rootNodes: [rootNode],
  settings: {
    autoSave: true,
    autoLayout: true,
    showGrid: false,
    animationEnabled: true,
  },
};

describe('FileOperationsService', () => {
  it('round-trips the current exported map format', () => {
    const exported = FileOperationsService.exportMapAsJson(mapData);
    const result = FileOperationsService.parseImportData(exported);

    expect(result).toEqual({ success: true, data: mapData });
  });

  it('normalizes a legacy single-root import', () => {
    const result = FileOperationsService.parseImportData(JSON.stringify({
      id: 'legacy-map',
      title: 'Legacy map',
      rootNode,
    }));

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      title: 'Legacy map',
      mapIdentifier: { mapId: 'legacy-map', workspaceId: '__default__' },
      rootNodes: [rootNode],
      settings: { autoSave: true, autoLayout: true, showGrid: false, animationEnabled: true },
    });
  });

  it.each([
    '',
    'not json',
    JSON.stringify({ title: 'missing root' }),
    JSON.stringify({ ...mapData, rootNodes: [{ id: 'missing children', text: 'x' }] }),
    JSON.stringify({ ...mapData, mapIdentifier: { mapId: 'only-one-field' } }),
  ])('rejects malformed input: %s', (input) => {
    expect(FileOperationsService.parseImportData(input).success).toBe(false);
  });

  it('returns an empty string when exporting no map', () => {
    expect(FileOperationsService.exportMapAsJson(null)).toBe('');
  });
});
