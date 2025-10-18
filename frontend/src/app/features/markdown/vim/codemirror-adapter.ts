/**
 * CodeMirror Vim adapter
 * Provides vim mode integration for CodeMirror 6
 */

import { Vim } from '@replit/codemirror-vim';

export type VimApi = typeof Vim;

/**
 * Get Vim API for custom mappings
 */
export function getVimApi(): VimApi {
  return Vim;
}

/**
 * Check if vim mode is available
 */
export function isVimAvailable(): boolean {
  return typeof Vim !== 'undefined';
}

/**
 * Apply custom vim mappings
 */
export function applyVimMappings(
  mappings: Array<{ lhs: string; rhs: string; context?: string }>
): void {
  if (!isVimAvailable()) return;

  mappings.forEach(({ lhs, rhs, context = 'normal' }) => {
    try {
      Vim.map(lhs, rhs, context);
    } catch (error) {
      console.warn(`Failed to apply vim mapping: ${lhs} -> ${rhs}`, error);
    }
  });
}

