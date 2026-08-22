import { describe, expect, it, vi } from 'vitest';
import { navigateLink } from './linkNavigation';
import type { MindMapNode } from '@shared/types';

const node = (id: string, text: string, children: MindMapNode[] = []): MindMapNode => ({
  id, text, children, x: 0, y: 0, fontSize: 14, fontWeight: 'normal'
});

const context = (overrides: Partial<Parameters<typeof navigateLink>[1]> = {}) => ({
  currentMapId: 'map-1', dataRoot: node('root', 'Root', [node('target', 'Target Node')]),
  selectMapById: vi.fn().mockResolvedValue(true), currentWorkspaceId: 'ws-1',
  selectNode: vi.fn(), notify: vi.fn(), getCurrentRootNode: vi.fn(() => node('root', 'Root', [node('target', 'Target Node')])),
  ...overrides
});

describe('navigateLink', () => {
  it('selects a node by id in the current map', async () => {
    const ctx = context();
    await navigateLink({ id: 'link', targetNodeId: 'target' }, ctx);
    expect(ctx.selectNode).toHaveBeenCalledWith('target');
    expect(ctx.notify).toHaveBeenCalledWith('success', 'ノードに移動しました');
  });

  it('finds text anchors loosely and reports missing anchors', async () => {
    const ctx = context();
    await navigateLink({ id: 'link', targetNodeId: 'text:target   node' }, ctx);
    expect(ctx.selectNode).toHaveBeenCalledWith('target');
    expect(ctx.notify).toHaveBeenCalledWith('success', 'ノード "Target Node" に移動しました');

    const missing = context();
    await navigateLink({ id: 'link', targetNodeId: 'text:missing' }, missing);
    expect(missing.notify).toHaveBeenCalledWith('error', 'ノード "missing" が見つかりません');
  });

  it('switches maps, selects the target node after a successful switch, and handles failure', async () => {
    const ctx = context();
    await navigateLink({ id: 'link', targetMapId: 'map-2', targetNodeId: 'target' }, ctx);
    expect(ctx.selectMapById).toHaveBeenCalledWith({ mapId: 'map-2', workspaceId: 'ws-1' });
    expect(ctx.selectNode).toHaveBeenCalledWith('target');

    const failed = context({ selectMapById: vi.fn().mockResolvedValue(false) });
    await navigateLink({ id: 'link', targetMapId: 'map-2' }, failed);
    expect(failed.notify).toHaveBeenCalledWith('error', 'マップ "map-2" が見つかりません');
  });

  it('reports empty links and catches handler failures', async () => {
    const empty = context();
    await navigateLink({ id: 'link' }, empty);
    expect(empty.notify).toHaveBeenCalledWith('info', 'リンク先が指定されていません');

    const broken = context({ selectNode: vi.fn(() => { throw new Error('boom'); }) });
    await navigateLink({ id: 'link', targetNodeId: 'target' }, broken);
    expect(broken.notify).toHaveBeenCalledWith('error', 'リンクの処理に失敗しました');
  });
});
