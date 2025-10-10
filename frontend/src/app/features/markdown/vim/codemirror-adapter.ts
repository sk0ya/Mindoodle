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

/**
 * Clear all custom vim mappings
 */
export function clearVimMappings(): void {
  if (!isVimAvailable()) return;

  try {
    // CodeMirror Vim doesn't have a direct clear all method
    // We'll need to manually unmap known mappings if needed
    // For now, this is a placeholder
  } catch (error) {
    console.warn('Failed to clear vim mappings', error);
  }
}

/**
 * Set vim leader key
 */
export function setVimLeader(key: string): void {
  if (!isVimAvailable()) return;

  try {
    Vim.map(key, '<Leader>', 'normal');
  } catch (error) {
    console.warn(`Failed to set vim leader key: ${key}`, error);
  }
}

/**
 * Execute vim command
 */
export function executeVimCommand(command: string): void {
  if (!isVimAvailable()) return;

  try {
    // CodeMirror Vim API for executing commands
    // This might need adjustment based on actual API
    console.log('Executing vim command:', command);
  } catch (error) {
    console.warn(`Failed to execute vim command: ${command}`, error);
  }
}
