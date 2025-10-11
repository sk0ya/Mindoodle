

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

  execute(context: CommandContext, args: Record<string, unknown>): CommandResult {
    const nodeId = (args['nodeId'] as string | undefined) || context.selectedNodeId;
    const newText = args['text'] as string | undefined;
    const keepText = (args['keep-text'] as boolean | undefined) ?? false;
    const cursorPosition = (args['cursor'] as string | undefined) || 'start';

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
      if (newText !== undefined) {
        context.handlers.updateNode(nodeId, { text: newText });
      } else if (!keepText) {
        context.handlers.updateNode(nodeId, { text: '' });
      }

      // Start editing with appropriate cursor position
      setTimeout(() => {
        if (cursorPosition === 'end') {
          context.handlers.startEditWithCursorAtEnd(nodeId);
        } else {
          context.handlers.startEditWithCursorAtStart(nodeId);
        }
      }, 10);

      let action: string;
      if (newText !== undefined) {
        action = 'set text and started editing';
      } else if (keepText) {
        action = 'started editing';
      } else {
        action = 'cleared text and started editing';
      }

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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

  execute(context: CommandContext, args: Record<string, unknown>): CommandResult {
    const nodeId = (args['nodeId'] as string | undefined) || context.selectedNodeId;
    const count = context.count ?? 1;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    try {

      const store = useMindMapStore.getState();
      try { store.beginHistoryGroup?.('cut'); } catch {
        // History group not available
      }


      let cutCount = 0;

      for (let i = 0; i < count; i++) {
        const currentNode = context.handlers.findNodeById(nodeId);
        if (!currentNode || currentNode.id === 'root') break;


        context.handlers.copyNode(nodeId);


        context.handlers.deleteNode(nodeId);
        cutCount++;
      }


      try { store.endHistoryGroup?.(true); } catch {
        // History group not available
      }

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

      const store = useMindMapStore.getState();
      try { store.endHistoryGroup?.(false); } catch {
        // History group not available
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cut node'
      };
    }
  },
  countable: true,
  repeatable: true
};