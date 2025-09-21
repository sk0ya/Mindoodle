/**
 * 文字列操作用のユーティリティ関数
 * 共通的な文字列処理パターンを提供
 */

/**
 * パスから最後のセグメント（ファイル名など）を取得
 */
export function getLastPathSegment(path: string, separator: string = '/'): string {
  if (!path) return '';
  return path.split(separator).pop() || '';
}

/**
 * パスから最後のセグメントを除いた親パスを取得
 */
export function getParentPath(path: string, separator: string = '/'): string {
  if (!path) return '';
  const segments = path.split(separator);
  return segments.slice(0, -1).join(separator);
}

/**
 * パスをセグメントに分割（空の要素を除外）
 */
export function splitPath(path: string, separator: string = '/'): string[] {
  if (!path) return [];
  return path.split(separator).filter(Boolean);
}

/**
 * パスセグメントを結合
 */
export function joinPath(...segments: string[]): string {
  return segments.filter(Boolean).join('/');
}

/**
 * ファイル名からファイル名（拡張子なし）を取得
 */
export function getFileNameWithoutExtension(fileName: string): string {
  if (!fileName) return '';
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

/**
 * ファイル名から拡張子を取得
 */
export function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot + 1) : '';
}

/**
 * ファイルパスからファイル名を取得
 */
export function getFileName(filePath: string): string {
  return getLastPathSegment(filePath);
}

/**
 * ファイルパスからディレクトリパスを取得
 */
export function getDirectoryPath(filePath: string): string {
  return getParentPath(filePath);
}

/**
 * パスを正規化（重複した区切り文字を除去）
 */
export function normalizePath(path: string, separator: string = '/'): string {
  if (!path) return '';
  return path.replace(new RegExp(`${separator}+`, 'g'), separator)
             .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
}

/**
 * 安全なファイル名に変換（不正な文字を置換）
 */
export function sanitizeFileName(fileName: string, replacement: string = '_'): string {
  if (!fileName) return '';
  return fileName.replace(/[/\\:*?"<>|]/g, replacement).trim();
}

/**
 * 文字列を指定された長さで切り詰め
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * キャメルケースをケバブケースに変換
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * ケバブケースをキャメルケースに変換
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 文字列が空またはnull/undefinedかチェック
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * 文字列をデフォルト値で置換（空の場合）
 */
export function defaultIfEmpty(str: string | null | undefined, defaultValue: string): string {
  return isEmpty(str) ? defaultValue : str!;
}

/**
 * パスの階層レベルを取得
 */
export function getPathDepth(path: string, separator: string = '/'): number {
  if (!path) return 0;
  return splitPath(path, separator).length;
}

/**
 * 相対パスかどうかを判定
 */
export function isRelativePath(path: string): boolean {
  if (!path) return false;
  return path.startsWith('./') || path.startsWith('../') || (!path.startsWith('/') && !path.includes('://'));
}

/**
 * 絶対パスかどうかを判定
 */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;
  return path.startsWith('/') || path.includes('://');
}

/**
 * URLかどうかを判定
 */
export function isUrl(str: string): boolean {
  if (!str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 文字列の最初の文字を大文字にする
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * パスが特定の拡張子を持つかチェック
 */
export function hasExtension(path: string, extensions: string | string[]): boolean {
  if (!path) return false;
  const ext = getFileExtension(path).toLowerCase();
  const targetExts = Array.isArray(extensions)
    ? extensions.map(e => e.toLowerCase())
    : [extensions.toLowerCase()];
  return targetExts.includes(ext);
}