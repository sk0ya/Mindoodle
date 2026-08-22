import { describe, expect, it } from 'vitest';
import type { MindMapData } from '@shared/types';
import { createTestNode } from '../test-helpers/testNodeFactory';
import {
  addLinkToNode,
  getLinkDisplayText,
  getLinkTargetInfo,
  removeLinkFromNode,
  updateLinkInNode,
  validateLink,
} from './linkUtils';

describe('linkUtils', () => {
  it('preserves all supplied link metadata when adding a link', () => {
    const node = createTestNode({ id: 'node-1' });

    const updated = addLinkToNode(node, {
      id: 'link-1',
      title: 'Design doc',
      url: 'https://example.test/design',
      description: 'Architecture notes',
      targetMapId: 'map-1',
      targetNodeId: 'node-2',
      targetAnchor: 'section-a',
    });

    expect(updated.links).toEqual([{
      id: 'link-1',
      title: 'Design doc',
      url: 'https://example.test/design',
      description: 'Architecture notes',
      targetMapId: 'map-1',
      targetNodeId: 'node-2',
      targetAnchor: 'section-a',
    }]);
    expect(node.links).toBeUndefined();
  });

  it('creates an id when the caller does not provide one', () => {
    const updated = addLinkToNode(createTestNode({ id: 'node-1' }), { title: 'Untitled' });

    expect(updated.links).toHaveLength(1);
    expect(updated.links?.[0].id).toEqual(expect.any(String));
    expect(updated.links?.[0].title).toBe('Untitled');
  });

  it('updates and removes only the requested link', () => {
    const node = createTestNode({
      links: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    });

    const updated = updateLinkInNode(node, 'a', { title: 'A updated', targetNodeId: 'target' });
    const removed = removeLinkFromNode(updated, 'b');

    expect(removed.links).toEqual([{ id: 'a', title: 'A updated', targetNodeId: 'target' }]);
    expect(node.links?.[0].title).toBe('A');
  });

  it('validates link target id lengths', () => {
    expect(validateLink({ targetMapId: 'm'.repeat(50) }).isValid).toBe(true);
    expect(validateLink({ targetMapId: 'm'.repeat(51) })).toEqual({
      isValid: false,
      errors: ['ターゲットマップIDは50文字以内で入力してください'],
    });
  });

  it('resolves current-map node targets and rejects missing targets', () => {
    const target = createTestNode({ id: 'target' });
    const data: MindMapData = {
      title: 'Map',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mapIdentifier: { mapId: 'map-1', workspaceId: 'local' },
      rootNodes: [target],
      settings: { autoSave: false, autoLayout: false, showGrid: false, animationEnabled: false },
    };

    expect(getLinkTargetInfo({ id: 'a', targetNodeId: 'target' }, data)).toMatchObject({
      isCurrentMap: true,
      targetNode: target,
      canNavigate: true,
    });
    expect(getLinkTargetInfo({ id: 'b', targetNodeId: 'missing' }, data).canNavigate).toBe(false);
    expect(getLinkTargetInfo({ id: 'c', targetMapId: 'other' }, data)).toMatchObject({
      isCurrentMap: false,
      targetNode: null,
      canNavigate: false,
    });
  });

  it('formats link display text for map and node targets', () => {
    expect(getLinkDisplayText({ id: 'a' })).toBe('内部リンク');
    expect(getLinkDisplayText({ id: 'b', targetMapId: 'map', targetNodeId: 'node' }))
      .toBe('Map: map → Node: node');
  });
});
