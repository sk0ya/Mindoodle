


export interface WorkspacePathInfo {
  workspaceId: string | null;
  relativePath: string | null;
}


export function extractWorkspaceId(path: string | null): string | null {
  if (!path) return null;
  const match = path.match(/^\/?(ws_[^/]+|cloud)/);
  return match ? match[1] : null;
}


export function parseWorkspacePath(path: string | null): WorkspacePathInfo {
  if (!path) {
    return { workspaceId: null, relativePath: null };
  }

  const match = path.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);

  if (match) {
    return {
      workspaceId: match[1],
      relativePath: match[2] || null
    };
  }

  return {
    workspaceId: null,
    relativePath: path
  };
}


export function isWorkspacePath(path: string | null): boolean {
  return extractWorkspaceId(path) !== null;
}


export function cleanWorkspacePath(path: string): string {
  const { relativePath } = parseWorkspacePath(path);
  return relativePath || '';
}

/**
 * ワークスペースIDとパスを結合
 *
 * @example
 * buildWorkspacePath('ws_abc', 'folder/map') 
 * buildWorkspacePath('cloud', null) 
 */
export function buildWorkspacePath(workspaceId: string, relativePath: string | null): string {
  if (!relativePath) {
    return `/${workspaceId}`;
  }
  return `/${workspaceId}/${relativePath}`;
}


export function buildChildPath(parentPath: string | null, childName: string): string {
  if (!parentPath) {
    return childName;
  }
  return `${parentPath}/${childName}`;
}


export function extractParentPaths(path: string): string[] {
  if (!path) return [];

  const segments = path.split('/').filter(seg => seg.trim());
  const parentPaths: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    parentPaths.push(segments.slice(0, i).join('/'));
  }

  return parentPaths;
}


export function normalizePathSeparators(path: string): string {
  return path
    .replace(/\/+/g, '/') 
    .replace(/^\/|\/$/g, ''); // 前後のスラッシュを削除
}

/**
 * ワークスペースIDを解決（フォールバック付き）
 *
 * @param path - 解析対象のパス
 * @param fallbackWorkspaceId - パスにワークスペースIDがない場合のフォールバック
 * @param defaultWorkspaceId - フォールバックもない場合のデフォルト値
 * @returns 解決されたワークスペースID
 */
export function resolveWorkspaceId(
  path: string | null,
  fallbackWorkspaceId: string | null,
  defaultWorkspaceId: string = 'local'
): string {
  const extracted = extractWorkspaceId(path);
  if (extracted) return extracted;
  if (fallbackWorkspaceId) return fallbackWorkspaceId;
  return defaultWorkspaceId;
}
