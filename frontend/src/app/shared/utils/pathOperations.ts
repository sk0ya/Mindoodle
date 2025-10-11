


export interface WorkspacePathInfo {
  workspaceId: string | null;
  relativePath: string | null;
}


export function extractWorkspaceId(path: string | null): string | null {
  if (!path) return null;
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (p.startsWith('cloud')) return 'cloud';
  if (p.startsWith('ws_')) {
    const slash = p.indexOf('/');
    return slash >= 0 ? p.slice(0, slash) : p;
  }
  return null;
}


export function parseWorkspacePath(path: string | null): WorkspacePathInfo {
  if (!path) {
    return { workspaceId: null, relativePath: null };
  }
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (p.startsWith('cloud')) {
    const rest = p.length > 'cloud'.length ? p.slice('cloud'.length + 1) : '';
    return { workspaceId: 'cloud', relativePath: rest || null };
  }
  if (p.startsWith('ws_')) {
    const slash = p.indexOf('/');
    if (slash >= 0) {
      return { workspaceId: p.slice(0, slash), relativePath: p.slice(slash + 1) || null };
    }
    return { workspaceId: p, relativePath: null };
  }
  return { workspaceId: null, relativePath: path };
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
    .replace(/(?:^\/|\/$)/g, ''); // 前後のスラッシュを削除（演算子の優先順位を明示）
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
