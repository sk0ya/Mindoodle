import type { ExplorerItem } from '@core/types';

const isWorkspaceRoot = (path: string): boolean => /^\/?(?:ws_[^/]+|cloud)\/?$/.test(path || '');

export function collectMissingExplorerCollapsedPaths(
  tree: ExplorerItem,
  collapsed: Record<string, boolean>
): Record<string, boolean> {
  const missing: Record<string, boolean> = {};

  const visit = (item: ExplorerItem) => {
    if (item.type !== 'folder') {
      return;
    }

    const path = item.path || '';
    if (!(path in collapsed) && !(path in missing)) {
      missing[path] = isWorkspaceRoot(path) ? false : true;
    }

    if (Array.isArray(item.children)) {
      item.children.forEach(visit);
    }
  };

  visit(tree);
  return missing;
}
