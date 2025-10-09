/**
 * Consolidated path operations utility
 * 重複したパス操作ロジックを統合
 */

/**
 * ワークスペースパス解析結果
 */
export interface WorkspacePathInfo {
  workspaceId: string | null;
  relativePath: string | null;
}

/**
 * パスからワークスペースIDを抽出
 * Pattern: /ws_xxx/... or /cloud/...
 *
 * @example
 * extractWorkspaceId('/ws_abc/folder/map') // => 'ws_abc'
 * extractWorkspaceId('/cloud/folder') // => 'cloud'
 * extractWorkspaceId('folder/map') // => null
 */
export function extractWorkspaceId(path: string | null): string | null {
  if (!path) return null;
  const match = path.match(/^\/?(ws_[^/]+|cloud)/);
  return match ? match[1] : null;
}

/**
 * パスからワークスペースIDと相対パスを分離
 *
 * @example
 * parseWorkspacePath('/ws_abc/folder/map')
 * // => { workspaceId: 'ws_abc', relativePath: 'folder/map' }
 *
 * parseWorkspacePath('/cloud/folder')
 * // => { workspaceId: 'cloud', relativePath: 'folder' }
 *
 * parseWorkspacePath('folder/map')
 * // => { workspaceId: null, relativePath: 'folder/map' }
 */
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

/**
 * ワークスペースIDを含むパスかどうか判定
 */
export function isWorkspacePath(path: string | null): boolean {
  return extractWorkspaceId(path) !== null;
}

/**
 * ワークスペースIDをパスから除去
 *
 * @example
 * cleanWorkspacePath('/ws_abc/folder/map') // => 'folder/map'
 * cleanWorkspacePath('/cloud/folder') // => 'folder'
 * cleanWorkspacePath('folder/map') // => 'folder/map'
 */
export function cleanWorkspacePath(path: string): string {
  const { relativePath } = parseWorkspacePath(path);
  return relativePath || '';
}

/**
 * ワークスペースIDとパスを結合
 *
 * @example
 * buildWorkspacePath('ws_abc', 'folder/map') // => '/ws_abc/folder/map'
 * buildWorkspacePath('cloud', null) // => '/cloud'
 */
export function buildWorkspacePath(workspaceId: string, relativePath: string | null): string {
  if (!relativePath) {
    return `/${workspaceId}`;
  }
  return `/${workspaceId}/${relativePath}`;
}

/**
 * 親パスと子要素名から子パスを構築
 *
 * @example
 * buildChildPath('folder/parent', 'child') // => 'folder/parent/child'
 * buildChildPath(null, 'child') // => 'child'
 * buildChildPath('', 'child') // => 'child'
 */
export function buildChildPath(parentPath: string | null, childName: string): string {
  if (!parentPath) {
    return childName;
  }
  return `${parentPath}/${childName}`;
}

/**
 * パスから全ての親パスを抽出（自身を除く）
 *
 * @example
 * extractParentPaths('a/b/c/d') // => ['a', 'a/b', 'a/b/c']
 * extractParentPaths('a') // => []
 */
export function extractParentPaths(path: string): string[] {
  if (!path) return [];

  const segments = path.split('/').filter(seg => seg.trim());
  const parentPaths: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    parentPaths.push(segments.slice(0, i).join('/'));
  }

  return parentPaths;
}

/**
 * パスセパレータを正規化（連続スラッシュを1つに、前後のスラッシュを削除）
 *
 * @example
 * normalizePathSeparators('//folder//path/') // => 'folder/path'
 * normalizePathSeparators('/folder/path') // => 'folder/path'
 */
export function normalizePathSeparators(path: string): string {
  return path
    .replace(/\/+/g, '/') // 連続スラッシュを1つに
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
