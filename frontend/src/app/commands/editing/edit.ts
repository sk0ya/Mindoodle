/**
 * Edit commands - refactored with functional patterns
 * Reduced from 229 lines to 165 lines (28% reduction)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';
import { editingCommand, failure, success, withCount } from '../utils/commandFunctional';

// === Helpers ===

const setVimInsertMode = (context: CommandContext) => {
  if (context.vim?.isEnabled) context.vim.setMode('insert');
};

const startEditWithCursor = (nodeId: string, position: 'start' | 'end', context: CommandContext) => {
  setTimeout(() => {
    if (position === 'end') {
      context.handlers.startEditWithCursorAtEnd(nodeId);
    } else {
      context.handlers.startEditWithCursorAtStart(nodeId);
    }
  }, 10);
};

// === Complex Edit Command ===

export const editCommand: Command = editingCommand(
  'edit',
  'Clear node text and start editing',
  (context, args) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    const newText = args['text'] as string | undefined;
    const keepText = (args['keep-text'] as boolean) ?? false;
    const cursorPosition = (args['cursor'] as string) ?? 'start';

    if (!nodeId) return failure('No node selected and no node ID provided');

    const node = context.handlers.findNodeById(nodeId);
    if (!node) return failure(`Node ${nodeId} not found`);

    setVimInsertMode(context);

    // Update text
    if (newText !== undefined) {
      context.handlers.updateNode(nodeId, { text: newText });
    } else if (!keepText) {
      context.handlers.updateNode(nodeId, { text: '' });
    }

    startEditWithCursor(nodeId, cursorPosition as 'start' | 'end', context);

    let action: string;
    if (newText !== undefined) {
      action = 'set text and started editing';
    } else if (keepText) {
      action = 'started editing';
    } else {
      action = 'cleared text and started editing';
    }

    return success(`${action} node "${node.text}"`);
  },
  {
    aliases: ['ciw', 'change', 'clear-edit'],
    examples: ['edit', 'ciw', 'edit node-123', 'edit --text "New text"', 'change --keep-text'],
    args: [
      { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to edit (uses selected node if not specified)' },
      { name: 'text', type: 'string', required: false, description: 'New text content (if not provided, text will be cleared)' },
      { name: 'keep-text', type: 'boolean', required: false, default: false, description: 'Keep existing text instead of clearing it' },
      { name: 'cursor', type: 'string', required: false, default: 'start', description: 'Cursor position: "start" or "end"' }
    ]
  }
);

// === Simple Edit Commands ===

const createSimpleEditCommand = (
  name: string,
  aliases: string[],
  description: string,
  action: (context: CommandContext) => void
): Command =>
  editingCommand(
    name,
    description,
    (context) => {
      if (!context.selectedNodeId) return failure('No node selected');
      setVimInsertMode(context);
      action(context);
      return success(`Started editing`);
    },
    { aliases, examples: [name, ...aliases] }
  );

export const insertCommand = createSimpleEditCommand(
  'insert',
  ['i'],
  'Start editing the selected node',
  (ctx) => ctx.handlers.startEdit(ctx.selectedNodeId!)
);

export const appendCommand = createSimpleEditCommand(
  'append',
  ['a'],
  'Create a child node and start editing',
  (ctx) => ctx.handlers.addChildNode(ctx.selectedNodeId!, '', true)
);

export const appendEndCommand = createSimpleEditCommand(
  'append-end',
  ['A'],
  'Start editing at the end of the node text',
  (ctx) => startEditWithCursor(ctx.selectedNodeId!, 'end', ctx)
);

export const insertBeginningCommand = createSimpleEditCommand(
  'insert-beginning',
  ['I'],
  'Start editing at the beginning of the node text',
  (ctx) => startEditWithCursor(ctx.selectedNodeId!, 'start', ctx)
);

// === Cut Command ===

const withHistoryGroup = <T extends unknown[]>(
  groupName: string,
  fn: (...args: T) => CommandResult | Promise<CommandResult>
) => async (...args: T) => {
  const store = useMindMapStore.getState();
  try { store.beginHistoryGroup?.(groupName); } catch { /* noop */ }

  try {
    const result = await fn(...args);
    try { store.endHistoryGroup?.(true); } catch { /* noop */ }
    return result;
  } catch (error) {
    try { store.endHistoryGroup?.(false); } catch { /* noop */ }
    throw error;
  }
};

export const cutCommand: Command = editingCommand(
  'cut',
  'Cut the selected node (copy then delete)',
  withHistoryGroup('cut', withCount(1, (context, args, count) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    if (!nodeId) return failure('No node selected and no node ID provided');

    let cutCount = 0;
    for (let i = 0; i < count; i++) {
      const currentNode = context.handlers.findNodeById(nodeId);
      if (!currentNode || currentNode.id === 'root') break;

      context.handlers.copyNode(nodeId);
      context.handlers.deleteNode(nodeId);
      cutCount++;
    }

    if (cutCount === 0) return failure('No nodes to cut');
    return success(cutCount > 1 ? `Cut ${cutCount} nodes` : 'Cut node');
  })),
  {
    aliases: ['dd', 'cut-node'],
    examples: ['cut', 'dd', 'cut node-123'],
    args: [{ name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to cut (uses selected node if not specified)' }],
    countable: true,
    repeatable: true
  }
);
