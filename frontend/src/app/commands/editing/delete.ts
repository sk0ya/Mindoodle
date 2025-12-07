import type { Command } from '../system/types';
import { editingCommand, failure, success, withCount } from '../utils/commandFunctional';
import { logger } from '@shared/utils';

export const deleteCommand: Command = editingCommand(
  'delete',
  'Delete the selected node',
  withCount(1, (context, args, count) => {
    const nodeId = (args['nodeId'] as string) || context.selectedNodeId;
    const skipConfirm = args['confirm'] as boolean;

    if (!nodeId) return failure('No node selected and no node ID provided');

    const node = context.handlers.findNodeById(nodeId);
    if (!node) return failure(`Node ${nodeId} not found`);
    if (node.id === 'root') return failure('Cannot delete the root node');

    // Warn if deleting node with children
    if (!skipConfirm && node.children?.length) {
      logger.warn(`Deleting node "${node.text}" with ${node.children.length} children`);
    }

    // Delete nodes based on count
    let deletedCount = 0;
    for (let i = 0; i < count; i++) {
      const currentNode = context.handlers.findNodeById(nodeId);
      if (!currentNode || currentNode.id === 'root') break;
      context.handlers.deleteNode(nodeId);
      deletedCount++;
    }

    return success(deletedCount > 1 ? `Deleted ${deletedCount} nodes` : `Deleted node "${node.text}"`);
  }),
  {
    aliases: ['delete-node', 'remove'],
    examples: ['delete', 'delete node-123', 'delete --confirm'],
    args: [
      { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to delete (uses selected node if not specified)' },
      { name: 'confirm', type: 'boolean', required: false, default: false, description: 'Skip confirmation prompt' }
    ],
    countable: true,
    repeatable: true
  }
);
