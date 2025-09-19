/**
 * UI Commands
 * Interface and panel management operations
 */

import type { Command, CommandContext, CommandResult } from '../types';

// Show/hide keyboard helper
export const helpCommand: Command = {
  name: 'help',
  aliases: ['?', 'keyboard-help'],
  description: 'Toggle keyboard shortcuts help panel',
  category: 'utility',
  examples: ['help', '?', 'keyboard-help'],

  execute(context: CommandContext): CommandResult {
    try {
      const currentState = context.handlers.showKeyboardHelper;
      context.handlers.setShowKeyboardHelper(!currentState);

      return {
        success: true,
        message: `${currentState ? 'Closed' : 'Opened'} keyboard shortcuts help`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle help panel'
      };
    }
  }
};

// Close all panels
export const closePanelsCommand: Command = {
  name: 'close-panels',
  aliases: ['close', 'escape'],
  description: 'Close all open panels and overlays',
  category: 'utility',
  examples: ['close-panels', 'close', 'escape'],

  execute(context: CommandContext): CommandResult {
    try {
      // Close all panels
      if (context.handlers.showMapList) context.handlers.setShowMapList(false);
      if (context.handlers.showLocalStorage) context.handlers.setShowLocalStorage(false);
      if (context.handlers.showTutorial) context.handlers.setShowTutorial(false);
      if (context.handlers.showKeyboardHelper) context.handlers.setShowKeyboardHelper(false);

      // Close attachment and link lists
      context.handlers.closeAttachmentAndLinkLists();

      return {
        success: true,
        message: 'Closed all panels'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close panels'
      };
    }
  }
};

// Start editing current node
export const startEditCommand: Command = {
  name: 'start-edit',
  aliases: ['edit-start'],
  description: 'Start editing the selected node',
  category: 'editing',
  examples: ['start-edit', 'edit-start', 'start-edit node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
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
      context.handlers.startEdit(nodeId);
      return {
        success: true,
        message: `Started editing "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing'
      };
    }
  }
};

// Start editing with cursor at end
export const startEditEndCommand: Command = {
  name: 'start-edit-end',
  aliases: ['edit-end'],
  description: 'Start editing with cursor at the end of node text',
  category: 'editing',
  examples: ['start-edit-end', 'edit-end'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
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
      context.handlers.startEditWithCursorAtEnd(nodeId);
      return {
        success: true,
        message: `Started editing "${node.text}" with cursor at end`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing'
      };
    }
  }
};

// Convert markdown node type
export const markdownConvertCommand: Command = {
  name: 'markdown-convert',
  aliases: ['convert-markdown', 'md-convert'],
  description: 'Convert markdown heading to list',
  category: 'editing',
  examples: ['markdown-convert', 'md-convert', 'convert-markdown node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to convert (uses selected node if not specified)'
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      default: 'unordered-list',
      description: 'Target type: heading, unordered-list, ordered-list'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const targetType = (args as any)['type'] || 'unordered-list';

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    if (!context.handlers.onMarkdownNodeType) {
      return {
        success: false,
        error: 'Markdown conversion is not available'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    // Check if node is a heading
    if (node.markdownMeta?.type !== 'heading') {
      return {
        success: false,
        error: 'Node is not a markdown heading'
      };
    }

    try {
      context.handlers.onMarkdownNodeType(nodeId, targetType as 'heading' | 'unordered-list' | 'ordered-list');
      return {
        success: true,
        message: `Converted "${node.text}" from heading to ${targetType}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert markdown node'
      };
    }
  }
};
