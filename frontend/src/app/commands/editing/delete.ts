

import type { Command, CommandContext, CommandResult } from '../system/types';

export const deleteCommand: Command = {
  name: 'delete',
  aliases: ['delete-node', 'remove'],
  description: 'Delete the selected node',
  category: 'editing',
  examples: [
    'delete',
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
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const skipConfirm = (args as any)['confirm'];
    const count = context.count ?? 1;

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

    
    if (node.id === 'root') {
      return {
        success: false,
        error: 'Cannot delete the root node'
      };
    }

    
    
    if (!skipConfirm && node.children && node.children.length > 0) {
      
      console.warn(`Deleting node "${node.text}" with ${node.children.length} children`);
    }

    try {
      
      let deletedCount = 0;

      for (let i = 0; i < count; i++) {
        const currentNode = context.handlers.findNodeById(nodeId);
        if (!currentNode || currentNode.id === 'root') break;

        context.handlers.deleteNode(nodeId);
        deletedCount++;

        
        
      }

      return {
        success: true,
        message: deletedCount > 1
          ? `Deleted ${deletedCount} nodes`
          : `Deleted node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete node'
      };
    }
  },
  countable: true,
  repeatable: true
};
