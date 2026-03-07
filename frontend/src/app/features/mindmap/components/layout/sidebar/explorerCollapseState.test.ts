import { describe, expect, it } from 'vitest';
import { collectMissingExplorerCollapsedPaths } from './explorerCollapseState';
import type { ExplorerItem } from '@core/types';

describe('collectMissingExplorerCollapsedPaths', () => {
  it('keeps existing folder state and only adds missing paths', () => {
    const tree: ExplorerItem = {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [
        {
          type: 'folder',
          name: 'workspace',
          path: '/ws_test',
          children: [
            {
              type: 'folder',
              name: 'alpha',
              path: '/ws_test/alpha',
              children: [
                {
                  type: 'folder',
                  name: 'beta',
                  path: '/ws_test/alpha/beta',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const collapsed = {
      '/': true,
      '/ws_test': false,
      '/ws_test/alpha': false,
    };

    expect(collectMissingExplorerCollapsedPaths(tree, collapsed)).toEqual({
      '/ws_test/alpha/beta': true,
    });
  });

  it('uses workspace-root defaults for brand new trees', () => {
    const tree: ExplorerItem = {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [
        {
          type: 'folder',
          name: 'workspace',
          path: '/ws_test',
          children: [
            {
              type: 'folder',
              name: 'alpha',
              path: '/ws_test/alpha',
              children: [],
            },
          ],
        },
      ],
    };

    expect(collectMissingExplorerCollapsedPaths(tree, {})).toEqual({
      '/': true,
      '/ws_test': false,
      '/ws_test/alpha': true,
    });
  });

  it('does not overwrite cloud state when a new local workspace is added', () => {
    const tree: ExplorerItem = {
      type: 'folder',
      name: 'root',
      path: '/',
      children: [
        {
          type: 'folder',
          name: 'Local',
          path: '/ws_local',
          children: [],
        },
        {
          type: 'folder',
          name: 'Cloud',
          path: '/cloud',
          children: [
            {
              type: 'folder',
              name: 'alpha',
              path: '/cloud/alpha',
              children: [],
            },
          ],
        },
      ],
    };

    const collapsed = {
      '/cloud': false,
      '/cloud/alpha': false,
    };

    expect(collectMissingExplorerCollapsedPaths(tree, collapsed)).toEqual({
      '/': true,
      '/ws_local': false,
    });
  });
});
