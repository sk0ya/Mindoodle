import { beforeEach, describe, expect, it } from 'vitest';
import type { MindMapData, MindMapNode, Position } from '@shared/types';
import { findNodeInRoots, getCanvasScale } from '@mindmap/utils';
import { useMindMapStore } from '../mindMapStore';

const createNode = (
  id: string,
  text: string,
  x: number,
  y: number,
  children: MindMapNode[] = []
): MindMapNode => ({
  id,
  text,
  x,
  y,
  fontSize: 14,
  fontWeight: 'normal',
  children,
});

const createMapData = (rootNodes: MindMapNode[]): MindMapData => ({
  title: 'Viewport insertion test',
  createdAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z',
  mapIdentifier: {
    workspaceId: '__test__',
    mapId: 'viewport-insertion-test',
  },
  rootNodes,
  settings: {
    autoSave: false,
    autoLayout: true,
    showGrid: false,
    animationEnabled: false,
  },
});

const getNode = (nodeId: string): MindMapNode => {
  const node = findNodeInRoots(useMindMapStore.getState().data?.rootNodes ?? [], nodeId);
  if (!node) throw new Error(`Missing node: ${nodeId}`);
  return node;
};

const getScreenCenter = (nodeId: string, pan: Position, zoom: number): Position => {
  const node = getNode(nodeId);
  const scale = getCanvasScale(zoom);
  return {
    x: (node.x + pan.x) * scale,
    y: (node.y + pan.y) * scale,
  };
};

describe('node insertion viewport compensation', () => {
  beforeEach(() => {
    const state = useMindMapStore.getState();
    state.setActiveView(null);
    state.setZoom(1);
    state.setPan({ x: 42, y: -27 });
    state.updateSettings({
      layoutType: 'mindmap',
      fontSize: 14,
      nodeSpacing: 8,
      nodeTextWrapEnabled: false,
    });
  });

  it('keeps the parent at the same screen position after adding a child node', () => {
    const root = createNode('node-root', 'Root', 120, 180);
    useMindMapStore.getState().setData(createMapData([root]));

    const beforePan = useMindMapStore.getState().ui.pan;
    const before = getScreenCenter('node-root', beforePan, 1);

    const newNodeId = useMindMapStore.getState().addChildNode('node-root', '');

    expect(newNodeId).toBeTruthy();
    const afterPan = useMindMapStore.getState().ui.pan;
    const after = getScreenCenter('node-root', afterPan, 1);
    expect(after).toEqual(before);
  });

  it('keeps the reference sibling at the same screen position after adding a sibling node', () => {
    const child = createNode('child', 'Child', 300, 240);
    const root = createNode('node-root', 'Root', 120, 180, [child]);
    useMindMapStore.getState().setData(createMapData([root]));

    const beforePan = useMindMapStore.getState().ui.pan;
    const before = getScreenCenter('child', beforePan, 1);

    const newNodeId = useMindMapStore.getState().addSiblingNode('child', '');

    expect(newNodeId).toBeTruthy();
    const afterPan = useMindMapStore.getState().ui.pan;
    const after = getScreenCenter('child', afterPan, 1);
    expect(after).toEqual(before);
  });
});
