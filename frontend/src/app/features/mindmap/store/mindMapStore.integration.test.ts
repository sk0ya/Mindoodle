import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MindMapData, MindMapNode } from '@shared/types';
import { useMindMapStore } from './mindMapStore';

const node = (id: string, text: string, children: MindMapNode[] = [], overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  collapsed: false,
  children,
  ...overrides,
});

const makeData = (rootNodes: MindMapNode[]): MindMapData => ({
  title: 'Integration map',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mapIdentifier: { mapId: 'integration', workspaceId: 'local' },
  rootNodes,
  settings: {
    autoSave: false,
    autoLayout: false,
    showGrid: false,
    animationEnabled: false,
  },
});

describe('mind map store integration', () => {
  beforeEach(() => {
    const store = useMindMapStore.getState();
    store.cancelPendingCommit();
    store.clearData();
    store.resetSettings();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    useMindMapStore.getState().cancelPendingCommit();
    vi.unstubAllGlobals();
  });

  it('normalizes loaded data and exposes O(1) node queries', () => {
    const child = node('child', 'Child');
    useMindMapStore.getState().setData(makeData([node('root', 'Root', [child])]));

    const store = useMindMapStore.getState();
    expect(store.findNode('child')?.text).toBe('Child');
    expect(store.getChildNodes('root').map(item => item.id)).toEqual(['child']);
    expect(store.getChildNodes('missing')).toEqual([]);
    expect(store.history).toEqual([]);
    expect(store.canUndo()).toBe(false);
  });

  it('adds children and siblings while keeping normalized and tree data in sync', () => {
    const root = node('root', 'Root', [], {
      collapsed: true,
      markdownMeta: { type: 'heading', level: 1, originalFormat: '#', lineNumber: 0 },
    });
    useMindMapStore.getState().setData(makeData([root]));

    const childId = useMindMapStore.getState().addChildNode('root', 'Child');
    expect(childId).toEqual(expect.any(String));
    if (!childId) throw new Error('Expected child node to be created');
    expect(useMindMapStore.getState().findNode('root')?.collapsed).toBe(false);
    expect(useMindMapStore.getState().getChildNodes('root').map(item => item.text)).toEqual(['Child']);
    expect(useMindMapStore.getState().data?.rootNodes[0].children).toHaveLength(1);

    const siblingId = useMindMapStore.getState().addSiblingNode(childId, 'Sibling');
    expect(siblingId).toEqual(expect.any(String));
    expect(useMindMapStore.getState().getChildNodes('root').map(item => item.text)).toEqual(['Child', 'Sibling']);
    expect(useMindMapStore.getState().selectedNodeId).toBe(siblingId);
  });

  it('blocks edits to preface nodes and supports normal text editing', () => {
    const preface = node('preface', 'Original', [], {
      markdownMeta: { type: 'preface', lineNumber: 0 },
    });
    const regular = node('regular', 'Before');
    useMindMapStore.getState().setData(makeData([preface, regular]));

    useMindMapStore.getState().updateNode('preface', { text: 'Must stay' });
    expect(useMindMapStore.getState().findNode('preface')?.text).toBe('Original');

    useMindMapStore.getState().startEditingWithCursorAtEnd('regular');
    expect(useMindMapStore.getState().editingMode).toBe('cursor-at-end');
    useMindMapStore.getState().finishEditing('regular', 'After');
    expect(useMindMapStore.getState().findNode('regular')?.text).toBe('After');
    expect(useMindMapStore.getState().editingNodeId).toBeNull();
  });

  it('deletes subtrees, selects a safe fallback, and protects the last root', () => {
    const root = node('root', 'Root', [node('a', 'A', [node('a-child', 'A child')]), node('b', 'B')]);
    useMindMapStore.getState().setData(makeData([root]));
    useMindMapStore.getState().selectNode('a');

    useMindMapStore.getState().deleteNode('a');
    expect(useMindMapStore.getState().findNode('a')).toBeNull();
    expect(useMindMapStore.getState().findNode('a-child')).toBeNull();
    expect(useMindMapStore.getState().selectedNodeId).toBe('b');

    useMindMapStore.getState().deleteNode('root');
    expect(useMindMapStore.getState().findNode('root')?.text).toBe('Root');
  });

  it('keeps links synchronized across tree and normalized representations', () => {
    useMindMapStore.getState().setData(makeData([node('root', 'Root')]));

    useMindMapStore.getState().addNodeLink('root', {
      id: 'link-1',
      title: 'Reference',
      url: 'https://example.test',
      targetNodeId: 'target',
    });
    expect(useMindMapStore.getState().findNode('root')?.links?.[0]).toMatchObject({
      id: 'link-1',
      title: 'Reference',
      url: 'https://example.test',
    });

    useMindMapStore.getState().updateNodeLink('root', 'link-1', { title: 'Updated' });
    expect(useMindMapStore.getState().data?.rootNodes[0].links?.[0].title).toBe('Updated');
    useMindMapStore.getState().deleteNodeLink('root', 'link-1');
    expect(useMindMapStore.getState().findNode('root')?.links).toEqual([]);
  });

  it('updates checkbox state after the animation frame boundary', () => {
    const task = node('task', 'Task', [], {
      markdownMeta: { type: 'unordered-list', isCheckbox: true, isChecked: false },
    });
    useMindMapStore.getState().setData(makeData([task]));

    useMindMapStore.getState().toggleNodeCheckbox('task', true);

    expect(useMindMapStore.getState().findNode('task')?.markdownMeta?.isChecked).toBe(true);
    expect(useMindMapStore.getState().data?.rootNodes[0].markdownMeta?.isChecked).toBe(true);
  });

  it('commits snapshots and supports undo/redo without restoring layout-only changes', () => {
    useMindMapStore.getState().setData(makeData([node('root', 'Before')]));
    useMindMapStore.getState().updateNode('root', { text: 'After', x: 500, y: 600 });
    useMindMapStore.getState().commitSnapshot();

    expect(useMindMapStore.getState().history).toHaveLength(1);
    expect(useMindMapStore.getState().findNode('root')?.text).toBe('After');
    useMindMapStore.getState().updateNode('root', { text: 'Final', x: 900 });
    useMindMapStore.getState().commitSnapshot();
    expect(useMindMapStore.getState().history).toHaveLength(2);

    useMindMapStore.getState().undo();
    expect(useMindMapStore.getState().findNode('root')?.text).toBe('After');
    useMindMapStore.getState().redo();
    expect(useMindMapStore.getState().findNode('root')?.text).toBe('Final');
  });
});
