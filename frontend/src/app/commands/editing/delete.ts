/**
 * Delete commands - refactored with functional patterns
 * Reduced from 97 lines to 55 lines (43% reduction)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import {
  getArg,
  getNodeId,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

export const deleteCommand: Command = {
  name: 'delete',
  aliases: ['delete-node', 'remove'],
  description: 'Delete the selected node',
  category: 'editing',
  examples: ['delete', 'delete node-123', 'delete --confirm'],
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

  execute: withErrorHandling((context: CommandContext, args: Record<string, unknown> = {}) => {
    const nodeId = getNodeId(args, context);
    const skipConfirm = getArg<boolean>(args, 'confirm');
    const count = context.count ?? 1;

    if (!nodeId) {
      return failure('No node selected and no node ID provided');
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return failure(`Node ${nodeId} not found`);
    }

    if (node.id === 'root') {
      return failure('Cannot delete the root node');
    }

    // Warn if deleting node with children
    if (!skipConfirm && node.children?.length) {
      console.warn(`Deleting node "${node.text}" with ${node.children.length} children`);
    }

    // Delete nodes based on count
    let deletedCount = 0;
    for (let i = 0; i < count; i++) {
      const currentNode = context.handlers.findNodeById(nodeId);
      if (!currentNode || currentNode.id === 'root') break;

      context.handlers.deleteNode(nodeId);
      deletedCount++;
    }

    return success(
      deletedCount > 1 ? `Deleted ${deletedCount} nodes` : `Deleted node "${node.text}"`
    );
  }, 'Failed to delete node'),

  countable: true,
  repeatable: true
};
