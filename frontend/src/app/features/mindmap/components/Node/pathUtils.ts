/**
 * Path validation utilities for file attachments and resources
 */

/**
 * Check if path is a relative local path
 *
 * Returns false for:
 * - HTTP/HTTPS URLs
 * - Data URLs
 * - Blob URLs
 * - Absolute paths starting with /
 *
 * Returns true for:
 * - Paths starting with ./
 * - Paths starting with ../
 * - Relative paths without protocol or leading slash
 *
 * @param path - Path string to validate
 * @returns True if path is relative local path
 */
export const isRelativeLocalPath = (path: string): boolean => {
  // Check for remote URLs
  if (/^(https?:|data:|blob:)/i.test(path)) {
    return false;
  }

  // Check for explicit relative paths
  if (path.startsWith('./') || path.startsWith('../')) {
    return true;
  }

  // Check for implicit relative paths (no protocol, no leading slash)
  return !path.includes('://') && !path.startsWith('/');
};
