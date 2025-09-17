/**
 * Delete Command
 * Deletes the selected node (equivalent to vim 'dd')
 */

import type { Command, CommandContext, CommandResult } from '../types';

export const deleteCommand: Command = {
  name: 'delete',
  aliases: ['dd', 'delete-node', 'remove'],
  description: 'Delete the selected node',
  category: 'editing',
  examples: [
    'delete',
    'dd',
    'delete node-123',
    'delete --confirm'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to delete (uses selected node if not specified)'
    },
    {
      name: 'confirm',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Skip confirmation prompt'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = args.nodeId || context.selectedNodeId;
    const skipConfirm = args.confirm;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    // Get node information for confirmation
    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    // Check if this is the root node (by checking if it has special ID)
    if (node.id === 'root') {
      return {
        success: false,
        error: 'Cannot delete the root node'
      };
    }

    // For now, skip confirmation in command mode
    // In the future, we could implement a confirmation system
    if (!skipConfirm && node.children && node.children.length > 0) {
      // Could implement confirmation dialog here
      console.warn(`Deleting node "${node.text}" with ${node.children.length} children`);
    }

    try {
      context.handlers.deleteNode(nodeId);
      return {
        success: true,
        message: `Deleted node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete node'
      };
    }
  }
};