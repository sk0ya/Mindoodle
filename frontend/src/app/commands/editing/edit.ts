/**
 * Edit commands - refactored with functional patterns
 * Reduced from 378 lines to ~200 lines
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';
import {
  createSimpleCommand,
  createEditCommand,
  createNodeCommand,
  getArg,
  getNodeId,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

// === Complex Edit Command ===

export const editCommand: Command = {
  name: 'edit',
  aliases: ['ciw', 'change', 'clear-edit'],
  description: 'Clear node text and start editing',
  category: 'editing',
  examples: ['edit', 'ciw', 'edit node-123', 'edit --text "New text"', 'change --keep-text'],
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

  execute: withErrorHandling((context: CommandContext, args: Record<string, unknown> = {}) => {
    const nodeId = getNodeId(args, context);
    const newText = getArg<string>(args, 'text');
    const keepText = getArg<boolean>(args, 'keep-text') ?? false;
    const cursorPosition = getArg<string>(args, 'cursor') ?? 'start';

    if (!nodeId) {
      return failure('No node selected and no node ID provided');
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return failure(`Node ${nodeId} not found`);
    }

    // Set vim mode
    if (context.vim?.isEnabled) {
      context.vim.setMode('insert');
    }

    // Update text
    if (newText !== undefined) {
      context.handlers.updateNode(nodeId, { text: newText });
    } else if (!keepText) {
      context.handlers.updateNode(nodeId, { text: '' });
    }

    // Start editing with cursor position
    setTimeout(() => {
      if (cursorPosition === 'end') {
        context.handlers.startEditWithCursorAtEnd(nodeId);
      } else {
        context.handlers.startEditWithCursorAtStart(nodeId);
      }
    }, 10);

    const action = newText !== undefined
      ? 'set text and started editing'
      : keepText
        ? 'started editing'
        : 'cleared text and started editing';

    return success(`${action} node "${node.text}"`);
  }, 'Failed to edit node')
};

// === Simple Edit Commands ===

export const insertCommand = createNodeCommand({
  name: 'insert',
  aliases: ['i'],
  description: 'Start editing the selected node',
  args: [], // No args, only uses selected node
  execute: (nodeId, _node, ctx) => {
    if (ctx.vim?.isEnabled) {
      ctx.vim.setMode('insert');
    }
    ctx.handlers.startEdit(nodeId);
  },
  successMsg: (node) => `Started editing node "${node.text}"`,
  repeatable: false,
  countable: false
});

export const appendCommand = createSimpleCommand({
  name: 'append',
  aliases: ['a'],
  description: 'Create a child node and start editing',
  canExecute: (ctx) => !!ctx.selectedNodeId,
  execute: (ctx) => {
    if (ctx.vim?.isEnabled) {
      ctx.vim.setMode('insert');
    }
    ctx.handlers.addChildNode(ctx.selectedNodeId!, '', true);
  },
  nothingMsg: 'No node selected',
  successMsg: 'Created child node and started editing'
});

export const appendEndCommand = createEditCommand({
  name: 'append-end',
  aliases: ['A'],
  description: 'Start editing at the end of the node text',
  cursorPosition: 'end',
  examples: ['append-end', 'A']
});

export const insertBeginningCommand = createEditCommand({
  name: 'insert-beginning',
  aliases: ['I'],
  description: 'Start editing at the beginning of the node text',
  cursorPosition: 'start',
  examples: ['insert-beginning', 'I']
});

// === Cut Command ===

// Helper: Create history group wrapper
const withHistoryGroup = <T extends unknown[]>(
  groupName: string,
  fn: (...args: T) => CommandResult | Promise<CommandResult>
) => async (...args: T): Promise<CommandResult> => {
  const store = useMindMapStore.getState();

  try {
    store.beginHistoryGroup?.(groupName);
  } catch {
    // History group not available
  }

  try {
    const result = await fn(...args);
    try {
      store.endHistoryGroup?.(true);
    } catch {
      // History group not available
    }
    return result;
  } catch (error) {
    try {
      store.endHistoryGroup?.(false);
    } catch {
      // History group not available
    }
    throw error;
  }
};

export const cutCommand: Command = {
  name: 'cut',
  aliases: ['dd', 'cut-node'],
  description: 'Cut the selected node (copy then delete)',
  category: 'editing',
  examples: ['cut', 'dd', 'cut node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to cut (uses selected node if not specified)'
    }
  ],

  execute: withErrorHandling(
    withHistoryGroup('cut', (context: CommandContext, args: Record<string, unknown> = {}) => {
      const nodeId = getNodeId(args, context);
      const count = context.count ?? 1;

      if (!nodeId) {
        return failure('No node selected and no node ID provided');
      }

      let cutCount = 0;

      for (let i = 0; i < count; i++) {
        const currentNode = context.handlers.findNodeById(nodeId);
        if (!currentNode || currentNode.id === 'root') break;

        context.handlers.copyNode(nodeId);
        context.handlers.deleteNode(nodeId);
        cutCount++;
      }

      if (cutCount === 0) {
        return failure('No nodes to cut');
      }

      return success(cutCount > 1 ? `Cut ${cutCount} nodes` : 'Cut node');
    }),
    'Failed to cut node'
  ),
  countable: true,
  repeatable: true
};
