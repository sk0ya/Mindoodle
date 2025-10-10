

import type { Command, CommandContext, CommandResult } from '../system/types';
import { toggleInlineMarkdown } from '../../features/markdown/parseInlineMarkdown';


export const toggleBoldCommand: Command = {
  name: 'toggle-bold',
  aliases: ['bold', 'B'],
  description: 'Toggle bold formatting (**text**)',
  category: 'editing',
  examples: [
    'toggle-bold',
    'bold',
    'B'
  ],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      const currentText = node.text || '';
      const { newText } = toggleInlineMarkdown(currentText, 'bold');

      context.handlers.updateNode(nodeId, { text: newText });

      return {
        success: true,
        message: `Toggled bold formatting for node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle bold'
      };
    }
  }
};


export const toggleItalicCommand: Command = {
  name: 'toggle-italic',
  aliases: ['italic', 'i-format'],
  description: 'Toggle italic formatting (*text*)',
  category: 'editing',
  examples: [
    'toggle-italic',
    'italic'
  ],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      const currentText = node.text || '';
      const { newText } = toggleInlineMarkdown(currentText, 'italic');

      context.handlers.updateNode(nodeId, { text: newText });

      return {
        success: true,
        message: `Toggled italic formatting for node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle italic'
      };
    }
  }
};


export const toggleStrikethroughCommand: Command = {
  name: 'toggle-strikethrough',
  aliases: ['strikethrough', 'strike', 'S'],
  description: 'Toggle strikethrough formatting (~~text~~)',
  category: 'editing',
  examples: [
    'toggle-strikethrough',
    'strikethrough',
    'strike',
    'S'
  ],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      const currentText = node.text || '';
      const { newText } = toggleInlineMarkdown(currentText, 'strikethrough');

      context.handlers.updateNode(nodeId, { text: newText });

      return {
        success: true,
        message: `Toggled strikethrough formatting for node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle strikethrough'
      };
    }
  }
};
