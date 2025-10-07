/**
 * Edit Command
 * Clears node text and starts editing (equivalent to vim 'ciw')
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';

export const editCommand: Command = {
  name: 'edit',
  aliases: ['ciw', 'change', 'clear-edit'],
  description: 'Clear node text and start editing',
  category: 'editing',
  examples: [
    'edit',
    'ciw',
    'edit node-123',
    'edit --text "New text"',
    'change --keep-text'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      description: 'New text content (if not provided, text will be cleared)'
    },
    {
      name: 'keep-text',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Keep existing text instead of clearing it'
    },
    {
      name: 'cursor',
      type: 'string',
      required: false,
      default: 'start',
      description: 'Cursor position: "start" or "end"'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const newText = (args as any)['text'];
    const keepText = (args as any)['keep-text'] ?? false;
    const cursorPosition = (args as any)['cursor'] || 'start';

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    // Get node information
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

      // Update node text if specified or clear if not keeping text
      if (newText !== undefined) {
        context.handlers.updateNode(nodeId, { text: newText });
      } else if (!keepText) {
        context.handlers.updateNode(nodeId, { text: '' });
      }

      // Start editing with appropriate cursor position
      setTimeout(() => {
        if (cursorPosition === 'end') {
          context.handlers.startEditWithCursorAtStart(nodeId);
        } else {
          context.handlers.startEditWithCursorAtStart(nodeId);
        }
      }, 10);

      const action = newText !== undefined ? 'set text and started editing' :
                   keepText ? 'started editing' : 'cleared text and started editing';

      return {
        success: true,
        message: `${action} node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit node'
      };
    }
  }
};

/**
 * Insert Command (vim 'i')
 * Start editing at current cursor position
 */
export const insertCommand: Command = {
  name: 'insert',
  aliases: ['i'],
  description: 'Start editing the selected node',
  category: 'editing',
  examples: ['insert', 'i'],

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing
      context.handlers.startEdit(nodeId);

      return {
        success: true,
        message: `Started editing node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing'
      };
    }
  }
};

/**
 * Append Command (vim 'a')
 * Create child node and start editing
 */
export const appendCommand: Command = {
  name: 'append',
  aliases: ['a'],
  description: 'Create a child node and start editing',
  category: 'editing',
  examples: ['append', 'a'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    try {
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create child node and start editing
      context.handlers.addChildNode(nodeId, '', true);

      return {
        success: true,
        message: 'Created child node and started editing'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create child node'
      };
    }
  }
};

/**
 * Append End Command (vim 'A')
 * Start editing at the end of the current node text
 */
export const appendEndCommand: Command = {
  name: 'append-end',
  aliases: ['A'],
  description: 'Start editing at the end of the node text',
  category: 'editing',
  examples: ['append-end', 'A'],

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at end
      context.handlers.startEditWithCursorAtEnd(nodeId);

      return {
        success: true,
        message: `Started editing node "${node.text}" with cursor at end`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing at end'
      };
    }
  }
};

/**
 * Insert Beginning Command (vim 'I')
 * Start editing at the beginning of the current node text
 */
export const insertBeginningCommand: Command = {
  name: 'insert-beginning',
  aliases: ['I'],
  description: 'Start editing at the beginning of the node text',
  category: 'editing',
  examples: ['insert-beginning', 'I'],

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at start
      context.handlers.startEditWithCursorAtStart(nodeId);

      return {
        success: true,
        message: `Started editing node "${node.text}" with cursor at beginning`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing at beginning'
      };
    }
  }
};

export const cutCommand: Command = {
  name: 'cut',
  aliases: ['dd', 'cut-node'],
  description: 'Cut the selected node (copy then delete)',
  category: 'editing',
  examples: [
    'cut',
    'dd',
    'cut node-123'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to cut (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const count = context.count ?? 1;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    try {
      // Begin history group for cut operation
      try { (useMindMapStore.getState() as any).beginHistoryGroup?.('cut'); } catch {}

      // Cut count times
      let cutCount = 0;

      for (let i = 0; i < count; i++) {
        const currentNode = context.handlers.findNodeById(nodeId);
        if (!currentNode || currentNode.id === 'root') break;

        // First copy the node to clipboard
        context.handlers.copyNode(nodeId);

        // Then delete the node
        context.handlers.deleteNode(nodeId);
        cutCount++;
      }

      // End history group and commit
      try { (useMindMapStore.getState() as any).endHistoryGroup?.(true); } catch {}

      if (cutCount === 0) {
        return {
          success: false,
          error: 'No nodes to cut'
        };
      }

      return {
        success: true,
        message: cutCount > 1 ? `Cut ${cutCount} nodes` : `Cut node`
      };
    } catch (error) {
      // End history group without commit on error
      try { (useMindMapStore.getState() as any).endHistoryGroup?.(false); } catch {}
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cut node'
      };
    }
  },
  countable: true,
  repeatable: true
};