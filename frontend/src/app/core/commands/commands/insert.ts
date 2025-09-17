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

// Open new line and insert (vim 'o') - Create younger sibling
export const openCommand: Command = {
  name: 'open',
  aliases: ['o', 'add-younger-sibling'],
  description: 'Create new younger sibling node and start editing (vim o)',
  category: 'editing',
  examples: [
    'open',
    'o',
    'open node-123',
    'add-younger-sibling --text "Initial text"'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Reference node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new sibling node'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = args.nodeId || context.selectedNodeId;
    const initialText = args.text || '';

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    const referenceNode = context.handlers.findNodeById(nodeId);
    if (!referenceNode) {
      return {
        success: false,
        error: `Reference node ${nodeId} not found`
      };
    }

    try {
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create new sibling node after the current node and start editing
      const newNodeId = await context.handlers.addSiblingNode(nodeId, initialText, true);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new sibling node'
        };
      }

      return {
        success: true,
        message: `Created new sibling node after "${referenceNode.text}" and started editing`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open new sibling node'
      };
    }
  }
};

// Open new line above and insert (vim 'O') - Create elder sibling
export const openAboveCommand: Command = {
  name: 'open-above',
  aliases: ['O', 'add-elder-sibling'],
  description: 'Create new elder sibling node and start editing (vim O)',
  category: 'editing',
  examples: [
    'open-above',
    'O',
    'open-above node-123',
    'add-elder-sibling --text "Initial text"'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Reference node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new sibling node'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = args.nodeId || context.selectedNodeId;
    const initialText = args.text || '';

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    const referenceNode = context.handlers.findNodeById(nodeId);
    if (!referenceNode) {
      return {
        success: false,
        error: `Reference node ${nodeId} not found`
      };
    }

    try {
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create a new elder sibling node before the current node (insertAfter: false)
      const newNodeId = await context.handlers.addSiblingNode(nodeId, initialText, true, false);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new elder sibling node'
        };
      }

      return {
        success: true,
        message: `Created new elder sibling node before "${referenceNode.text}" and started editing`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open new sibling node above'
      };
    }
  }
};