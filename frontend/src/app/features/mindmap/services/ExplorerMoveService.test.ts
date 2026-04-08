import { describe, expect, it, vi } from 'vitest';
import type { ExplorerItem, StorageAdapter } from '@core/types';
import { ExplorerMoveService } from './ExplorerMoveService';

const createAdapter = (overrides: Partial<StorageAdapter> = {}): StorageAdapter => ({
  isInitialized: true,
  loadAllMaps: vi.fn(async () => []),
  addMapToList: vi.fn(async () => {}),
  removeMapFromList: vi.fn(async () => {}),
  initialize: vi.fn(async () => {}),
  cleanup: vi.fn(),
  ...overrides
});

describe('ExplorerMoveService', () => {
  it('resolves workspace roots without fabricating relative paths', () => {
    expect(ExplorerMoveService.resolveMove('/ws_local/foo.md', '/cloud')).toEqual({
      sourceWorkspaceId: 'ws_local',
      sourceRelativePath: 'foo.md',
      targetWorkspaceId: 'cloud',
      targetRelativePath: ''
    });
  });

  it('moves markdown files across adapters and avoids name collisions', async () => {
    const sourceAdapter = createAdapter({
      getMapMarkdown: vi.fn(async () => '# Alpha\n'),
      deleteItem: vi.fn(async () => {})
    });
    const targetAdapter = createAdapter({
      saveMapMarkdown: vi.fn(async () => {})
    });
    const getAdapterForWorkspace = vi.fn((workspaceId: string | null) => (
      workspaceId === 'cloud' ? targetAdapter : sourceAdapter
    ));

    const explorerTree: ExplorerItem = {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [
        { type: 'folder', name: 'local', path: '/ws_local', children: [
          { type: 'file', name: 'alpha.md', path: '/ws_local/alpha.md', isMarkdown: true }
        ] },
        { type: 'folder', name: 'Cloud', path: '/cloud', children: [
          { type: 'file', name: 'alpha.md', path: '/cloud/alpha.md', isMarkdown: true }
        ] }
      ]
    };

    await ExplorerMoveService.moveAcrossAdapters({
      sourcePath: '/ws_local/alpha.md',
      targetFolderPath: '/cloud',
      explorerTree,
      getAdapterForWorkspace
    });

    expect(sourceAdapter.getMapMarkdown).toHaveBeenCalledWith({
      mapId: 'alpha',
      workspaceId: 'ws_local'
    });
    expect(targetAdapter.saveMapMarkdown).toHaveBeenCalledWith(
      { mapId: 'alpha-1', workspaceId: 'cloud' },
      '# Alpha\n'
    );
    expect(sourceAdapter.deleteItem).toHaveBeenCalledWith('/ws_local/alpha.md');
  });

  it('moves folders recursively across adapters', async () => {
    const sourceAdapter = createAdapter({
      getMapMarkdown: vi.fn(async () => '# Alpha\n'),
      readImageAsDataURL: vi.fn(async () => 'data:image/png;base64,aGVsbG8='),
      deleteItem: vi.fn(async () => {})
    });
    const targetAdapter = createAdapter({
      createFolder: vi.fn(async () => {}),
      saveMapMarkdown: vi.fn(async () => {}),
      saveImageFile: vi.fn(async () => {})
    });
    const getAdapterForWorkspace = vi.fn((workspaceId: string | null) => (
      workspaceId === 'cloud' ? targetAdapter : sourceAdapter
    ));

    const explorerTree: ExplorerItem = {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [
        {
          type: 'folder',
          name: 'local',
          path: '/ws_local',
          children: [
            {
              type: 'folder',
              name: 'Projects',
              path: '/ws_local/Projects',
              children: [
                { type: 'file', name: 'alpha.md', path: '/ws_local/Projects/alpha.md', isMarkdown: true },
                { type: 'file', name: 'cover.png', path: '/ws_local/Projects/cover.png' }
              ]
            }
          ]
        },
        { type: 'folder', name: 'Cloud', path: '/cloud', children: [] }
      ]
    };

    await ExplorerMoveService.moveAcrossAdapters({
      sourcePath: '/ws_local/Projects',
      targetFolderPath: '/cloud',
      explorerTree,
      getAdapterForWorkspace
    });

    expect(targetAdapter.createFolder).toHaveBeenCalledWith('Projects', 'cloud');
    expect(targetAdapter.saveMapMarkdown).toHaveBeenCalledWith(
      { mapId: 'Projects/alpha', workspaceId: 'cloud' },
      '# Alpha\n'
    );
    expect(targetAdapter.saveImageFile).toHaveBeenCalledTimes(1);
    expect(sourceAdapter.deleteItem).toHaveBeenCalledWith('/ws_local/Projects/alpha.md');
    expect(sourceAdapter.deleteItem).toHaveBeenCalledWith('/ws_local/Projects/cover.png');
  });
});
