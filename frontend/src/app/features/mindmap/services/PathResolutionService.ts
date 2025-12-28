/**
 * PathResolutionService
 *
 * Service for path resolution and category/title parsing.
 * Consolidates path logic previously scattered across hooks.
 */

export class PathResolutionService {
  /**
   * Extract category from map ID (everything before last segment)
   */
  static extractCategory(mapId: string): string {
    const parts = (mapId || '').split('/').filter(Boolean);
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  }

  /**
   * Parse title and category from title string containing slashes
   */
  static parseTitleAndCategory(
    title: string,
    category?: string
  ): { title: string; category: string } {
    if (title.includes('/')) {
      const parts = title.split('/').filter(Boolean);
      return {
        title: parts[parts.length - 1],
        category: parts.slice(0, -1).join('/')
      };
    }
    return { title, category: category || '' };
  }

  /**
   * Resolve relative path against base file path
   *
   * @param baseFilePath - Current map's file path (e.g., "folder/map.md")
   * @param relativePath - Relative path to resolve (e.g., "../image.png", "./file.md")
   * @returns Resolved path relative to workspace root
   */
  static resolvePath(baseFilePath: string, relativePath: string): string {
    // Absolute-like path inside workspace
    if (/^\//.test(relativePath)) {
      return relativePath.replace(/^\//, '');
    }

    // Get base directory of current map
    const baseDir = baseFilePath.includes('/')
      ? baseFilePath.replace(/\/[^/]*$/, '')
      : '';

    const baseSegs = baseDir ? baseDir.split('/') : [];
    const relSegs = relativePath.replace(/^\.\//, '').split('/');
    const out: string[] = [...baseSegs];

    for (const seg of relSegs) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (out.length > 0) out.pop();
      } else {
        out.push(seg);
      }
    }

    return out.join('/');
  }
}
