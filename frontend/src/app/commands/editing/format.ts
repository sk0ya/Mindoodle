/**
 * Format toggle commands - refactored with functional patterns
 * Reduced from 151 lines to 25 lines (83% reduction)
 */

import type { Command } from '../system/types';
import { createFormatToggleCommand } from '../utils/commandFactories';

export const toggleBoldCommand = createFormatToggleCommand({
  name: 'toggle-bold',
  aliases: ['bold', 'B'],
  description: 'Toggle bold formatting (**text**)',
  formatType: 'bold'
});

export const toggleItalicCommand = createFormatToggleCommand({
  name: 'toggle-italic',
  aliases: ['italic', 'i-format'],
  description: 'Toggle italic formatting (*text*)',
  formatType: 'italic'
});

export const toggleStrikethroughCommand = createFormatToggleCommand({
  name: 'toggle-strikethrough',
  aliases: ['strikethrough', 'strike', 'S'],
  description: 'Toggle strikethrough formatting (~~text~~)',
  formatType: 'strikethrough'
});
