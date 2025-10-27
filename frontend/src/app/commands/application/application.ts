/**
 * Application commands - refactored with functional patterns
 * Reduced from 165 lines to 110 lines (33% reduction)
 */

import type { Command, CommandContext } from '../system/types';
import { editingCommand, utilityCommand, failure, success } from '../utils/commandFunctional';
import { executePasteSibling } from '../utils/pasteHelpers';

// === Helpers ===

const createSimpleCommand = (
  name: string,
  aliases: string[],
  description: string,
  canExecute: (ctx: CommandContext) => boolean | undefined,
  execute: (ctx: CommandContext) => void,
  nothingMsg: string,
  successMsg: string
): Command =>
  utilityCommand(
    name,
    description,
    (context) => {
      if (!canExecute(context)) return failure(nothingMsg);
      execute(context);
      return success(successMsg);
    },
    { aliases, examples: [name, ...aliases] }
  );

const createNodeCommand = (
  name: string,
  aliases: string[],
  description: string,
  execute: (nodeId: string, ctx: CommandContext) => void | Promise<void>,
  successMsg: (nodeText: string) => string
): Command =>
  editingCommand(
    name,
    description,
    async (context) => {
      if (!context.selectedNodeId) return failure('No node selected');
      const node = context.handlers.findNodeById(context.selectedNodeId);
      if (!node) return failure('Node not found');
      await execute(context.selectedNodeId, context);
      const msg = successMsg(node.text);
      return msg ? success(msg) : success();
    },
    { aliases, examples: [name, ...aliases], repeatable: true, countable: false }
  );

// === History Commands ===

export const undoCommand = createSimpleCommand('undo', ['u'], 'Undo the last operation', (ctx) => ctx.handlers.canUndo, (ctx) => ctx.handlers.undo(), 'Nothing to undo', 'Undid last operation');
export const redoCommand = createSimpleCommand('redo', ['r'], 'Redo the last undone operation', (ctx) => ctx.handlers.canRedo, (ctx) => ctx.handlers.redo(), 'Nothing to redo', 'Redid last operation');

// === Clipboard Commands ===

export const copyCommand = createNodeCommand('copy', ['c'], 'Copy the selected node', (nodeId, ctx) => ctx.handlers.copyNode(nodeId), (text) => `Copied node "${text}"`);
export const copyTextCommand = createNodeCommand('copy-text', [], 'Copy node text only (without markdown formatting) to system clipboard', async (nodeId, ctx) => { if (ctx.handlers.copyNodeText) await ctx.handlers.copyNodeText(nodeId); }, () => '');

export const pasteCommand: Command = editingCommand(
  'paste',
  'Paste copied node as child',
  async (context, args) => {
    const targetId = (args['targetId'] as string) ?? context.selectedNodeId;
    if (!targetId) return failure('No node selected and no target ID provided');

    const targetNode = context.handlers.findNodeById(targetId);
    if (!targetNode) return failure(`Target node ${targetId} not found`);

    await context.handlers.pasteNode(targetId);
    return success(`Pasted as child of "${targetNode.text}"`);
  },
  {
    aliases: ['v'],
    examples: ['paste', 'v', 'paste node-123'],
    args: [{ name: 'targetId', type: 'node-id', required: false, description: 'Target node ID to paste into (uses selected node if not specified)' }]
  }
);

// === Paste Sibling Commands ===

const createPasteSiblingCommand = (name: string, description: string, after: boolean): Command => ({
  name,
  description,
  category: 'editing',
  examples: [name],
  execute: (ctx) => executePasteSibling(ctx, after),
  repeatable: true,
  countable: false
});

export const pasteSiblingAfterCommand = createPasteSiblingCommand('paste-sibling-after', 'Paste as younger sibling (after selected node)', true);
export const pasteSiblingBeforeCommand = createPasteSiblingCommand('paste-sibling-before', 'Paste as elder sibling (before selected node)', false);

// === Workspace Commands ===

export const addWorkspaceCommand: Command = utilityCommand(
  'addworkspace',
  'Add a new workspace by selecting a folder',
  async () => {
    const addWorkspaceFn = (window as Window & { mindoodleAddWorkspace?: () => Promise<void> }).mindoodleAddWorkspace;
    if (typeof addWorkspaceFn !== 'function') return failure('Workspace functionality not available');
    await addWorkspaceFn();
    return success('New workspace added successfully');
  },
  { aliases: ['workspace-add', 'ws-add'], examples: ['addworkspace', 'workspace-add'] }
);
