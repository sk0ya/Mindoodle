/**
 * Utilities for sanitizing and validating file names
 */

/**
 * Invalid characters for file names across different operating systems
 * Windows: < > : " / \ | ? *
 * Unix: /
 * Combined set for maximum compatibility
 */
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/**
 * Maximum file name length (excluding extension)
 * Most file systems support 255 characters, but we use a conservative limit
 */
const MAX_FILENAME_LENGTH = 100;

/**
 * Default file name when the sanitized name is empty
 */
const DEFAULT_FILENAME = '新しいマップ';

/**
 * Sanitize a string to be used as a file name
 * @param text - The text to sanitize
 * @returns A valid file name (without extension)
 */
export function sanitizeFileName(text: string): string {
  if (!text || typeof text !== 'string') {
    return DEFAULT_FILENAME;
  }

  // Remove invalid characters
  let sanitized = text.replace(INVALID_FILENAME_CHARS, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Truncate to maximum length
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH).trim();
  }

  // Return default if empty after sanitization
  if (!sanitized) {
    return DEFAULT_FILENAME;
  }

  return sanitized;
}

/**
 * Generate a unique file name by appending a number if the name already exists
 * @param baseName - The base file name (without extension)
 * @param existingNames - Set of existing file names (without extension)
 * @returns A unique file name (without extension)
 */
export function generateUniqueFileName(baseName: string, existingNames: Set<string>): string {
  let fileName = baseName;
  let counter = 1;

  while (existingNames.has(fileName)) {
    fileName = `${baseName}_${counter}`;
    counter++;
  }

  return fileName;
}

/**
 * Sanitize and ensure uniqueness for a file name
 * @param text - The text to use as base for the file name
 * @param existingNames - Set of existing file names (without extension)
 * @returns A sanitized and unique file name (without extension)
 */
export function sanitizeAndEnsureUnique(text: string, existingNames: Set<string>): string {
  const sanitized = sanitizeFileName(text);
  return generateUniqueFileName(sanitized, existingNames);
}
