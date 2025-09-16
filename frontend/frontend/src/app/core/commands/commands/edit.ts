/**
 * Edit Command
 * Clears node text and starts editing (equivalent to vim 'ciw')
 */

import type { Command, CommandContext, CommandResult } from '../types';

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
    const nodeId = args.nodeId || context.selectedNodeId;
    const newText = args.text;
    const keepText = args['keep-text'] ?? false;
    const cursorPosition = args.cursor || 'start';

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