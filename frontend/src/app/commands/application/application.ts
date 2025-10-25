/**
 * Application commands - refactored with functional patterns
 * Reduced from 587 lines to ~200 lines through composition and reusable utilities
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import {
  createSimpleCommand,
  createNodeCommand
} from '../utils/commandFactories';
import { executePasteSibling } from '../utils/pasteHelpers';

// === History Commands ===

export const undoCommand = createSimpleCommand({
  name: 'undo',
  aliases: ['u'],
  description: 'Undo the last operation',
  canExecute: (ctx) => ctx.handlers.canUndo,
  execute: (ctx) => ctx.handlers.undo(),
  nothingMsg: 'Nothing to undo',
  successMsg: 'Undid last operation'
});

export const redoCommand = createSimpleCommand({
  name: 'redo',
  aliases: ['r'],
  description: 'Redo the last undone operation',
  canExecute: (ctx) => ctx.handlers.canRedo,
  execute: (ctx) => ctx.handlers.redo(),
  nothingMsg: 'Nothing to redo',
  successMsg: 'Redid last operation'
});

// === Clipboard Commands ===

export const copyCommand = createNodeCommand({
  name: 'copy',
  aliases: ['c'],
  description: 'Copy the selected node',
  execute: (nodeId, _node, ctx) => ctx.handlers.copyNode(nodeId),
  successMsg: (node) => `Copied node "${node.text}"`,
  repeatable: true,
  countable: false
});

export const copyTextCommand = createNodeCommand({
  name: 'copy-text',
  description: 'Copy node text only (without markdown formatting) to system clipboard',
  execute: async (nodeId, _node, ctx) => {
    if (ctx.handlers.copyNodeText) {
      await ctx.handlers.copyNodeText(nodeId);
    }
  },
  successMsg: () => '',
  repeatable: true,
  countable: false
});

export const pasteCommand: Command = {
  name: 'paste',
  aliases: ['v'],
  description: 'Paste copied node as child',
  category: 'editing',
  examples: ['paste', 'v', 'paste node-123'],
  args: [
    {
      name: 'targetId',
      type: 'node-id',
      required: false,
      description: 'Target node ID to paste into (uses selected node if not specified)'
    }
  ],

  async execute(context: CommandContext, args: Record<string, unknown> = {}): Promise<CommandResult> {
    const targetId = (args['targetId'] as string | undefined) || context.selectedNodeId;

    if (!targetId) {
      return {
        success: false,
        error: 'No node selected and no target ID provided'
      };
    }

    const targetNode = context.handlers.findNodeById(targetId);
    if (!targetNode) {
      return {
        success: false,
        error: `Target node ${targetId} not found`
      };
    }

    try {
      await context.handlers.pasteNode(targetId);
      return {
        success: true,
        message: `Pasted as child of "${targetNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to paste'
      };
    }
  }
};

// === Paste Sibling Commands ===
// Dramatically simplified using shared executePasteSibling logic

export const pasteSiblingAfterCommand: Command = {
  name: 'paste-sibling-after',
  description: 'Paste as younger sibling (after selected node)',
  category: 'editing',
  examples: ['paste-sibling-after'],
  execute: (ctx) => executePasteSibling(ctx, true),
  repeatable: true,
  countable: false
};

export const pasteSiblingBeforeCommand: Command = {
  name: 'paste-sibling-before',
  description: 'Paste as elder sibling (before selected node)',
  category: 'editing',
  examples: ['paste-sibling-before'],
  execute: (ctx) => executePasteSibling(ctx, false),
  repeatable: true,
  countable: false
};

// === Workspace Commands ===

export const addWorkspaceCommand: Command = {
  name: 'addworkspace',
  aliases: ['workspace-add', 'ws-add'],
  description: 'Add a new workspace by selecting a folder',
  category: 'utility',
  examples: ['addworkspace', 'workspace-add'],

  async execute(): Promise<CommandResult> {
    try {
      const addWorkspaceFn = (
        window as Window & { mindoodleAddWorkspace?: () => Promise<void> }
      ).mindoodleAddWorkspace;

      if (typeof addWorkspaceFn !== 'function') {
        return {
          success: false,
          error: 'Workspace functionality not available'
        };
      }

      await addWorkspaceFn();
      return {
        success: true,
        message: 'New workspace added successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add workspace'
      };
    }
  }
};
