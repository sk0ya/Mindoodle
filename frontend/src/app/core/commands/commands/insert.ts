/**
 * Insert Commands
 * Vim-style insert mode commands (i, a, o)
 */

import type { Command, CommandContext, CommandResult } from '../types';

// Insert mode at cursor start (vim 'i')
export const insertCommand: Command = {
  name: 'insert',
  aliases: ['i', 'insert-start'],
  description: 'Start editing at the beginning of node text (vim i)',
  category: 'editing',
  examples: [
    'insert',
    'i',
    'insert node-123'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = args.nodeId || context.selectedNodeId;

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at start
      context.handlers.startEditWithCursorAtStart(nodeId);

      return {
        success: true,
        message: `Started editing "${node.text}" at cursor start`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start insert mode'
      };
    }
  }
};

// Append mode at cursor end (vim 'a')
export const appendCommand: Command = {
  name: 'append',
  aliases: ['a', 'insert-end'],
  description: 'Start editing at the end of node text (vim a)',
  category: 'editing',
  examples: [
    'append',
    'a',
    'append node-123'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = args.nodeId || context.selectedNodeId;

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at end
      context.handlers.startEditWithCursorAtEnd(nodeId);

      return {
        success: true,
        message: `Started editing "${node.text}" at cursor end`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start append mode'
      };
    }
  }
};

// Open new line and insert (vim 'o')
export const openCommand: Command = {
  name: 'open',
  aliases: ['o', 'new-child'],
  description: 'Create new child node and start editing (vim o)',
  category: 'editing',
  examples: [
    'open',
    'o',
    'open node-123',
    'new-child --text "Initial text"'
  ],
  args: [
    {
      name: 'parentId',
      type: 'node-id',
      required: false,
      description: 'Parent node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new child node'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const parentId = args.parentId || context.selectedNodeId;
    const initialText = args.text || '';

    if (!parentId) {
      return {
        success: false,
        error: 'No node selected and no parent ID provided'
      };
    }

    const parentNode = context.handlers.findNodeById(parentId);
    if (!parentNode) {
      return {
        success: false,
        error: `Parent node ${parentId} not found`
      };
    }

    try {
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create new child node and start editing
      const newNodeId = await context.handlers.addChildNode(parentId, initialText, true);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new child node'
        };
      }

      return {
        success: true,
        message: `Created new child node under "${parentNode.text}" and started editing`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open new child node'
      };
    }
  }
};