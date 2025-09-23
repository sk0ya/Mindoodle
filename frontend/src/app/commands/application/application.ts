/**
 * Application Commands
 * Core application-level operations (undo, redo, copy, paste)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

// Undo command
export const undoCommand: Command = {
  name: 'undo',
  aliases: ['u'],
  description: 'Undo the last operation',
  category: 'editing',
  examples: ['undo', 'u'],

  execute(context: CommandContext): CommandResult {
    if (!context.handlers.canUndo) {
      return {
        success: false,
        error: 'Nothing to undo'
      };
    }

    try {
      context.handlers.undo();
      return {
        success: true,
        message: 'Undid last operation'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to undo'
      };
    }
  }
};

// Redo command
export const redoCommand: Command = {
  name: 'redo',
  aliases: ['r'],
  description: 'Redo the last undone operation',
  category: 'editing',
  examples: ['redo', 'r'],

  execute(context: CommandContext): CommandResult {
    if (!context.handlers.canRedo) {
      return {
        success: false,
        error: 'Nothing to redo'
      };
    }

    try {
      context.handlers.redo();
      return {
        success: true,
        message: 'Redid last operation'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to redo'
      };
    }
  }
};

// Copy node command
export const copyCommand: Command = {
  name: 'copy',
  aliases: ['c'],
  description: 'Copy the selected node',
  category: 'editing',
  examples: ['copy', 'c', 'copy node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to copy (uses selected node if not specified)'
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
      context.handlers.copyNode(nodeId);
      return {
        success: true,
        message: `Copied node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy node'
      };
    }
  }
};

// Paste command
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

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const targetId = (args as any)['targetId'] || context.selectedNodeId;

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
      // Try to paste node content as child node (vim-like behavior)
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
// Cut command (equivalent to vim 'dd' - copy then delete)