/**
 * Toggle Command
 * Toggles the collapse state of a node's children (equivalent to vim 'za')
 */

import type { Command, CommandContext, CommandResult } from '../types';

export const toggleCommand: Command = {
  name: 'toggle',
  aliases: ['za', 'toggle-collapse', 'fold'],
  description: 'Toggle the collapse state of node children',
  category: 'structure',
  examples: [
    'toggle',
    'za',
    'toggle node-123',
    'fold --expand'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to toggle (uses selected node if not specified)'
    },
    {
      name: 'expand',
      type: 'boolean',
      required: false,
      description: 'Force expand (true) or collapse (false). If not specified, toggles current state'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = args.nodeId || context.selectedNodeId;
    const forceState = args.expand;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    // Get node information
    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    // Check if node has children
    if (!node.children || node.children.length === 0) {
      return {
        success: false,
        error: `Node "${node.text}" has no children to toggle`
      };
    }

    // Determine new state
    let newCollapsedState: boolean;
    if (forceState !== undefined) {
      newCollapsedState = !forceState; // collapsed is opposite of expanded
    } else {
      newCollapsedState = !node.collapsed; // toggle current state
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: newCollapsedState });

      const action = newCollapsedState ? 'collapsed' : 'expanded';
      return {
        success: true,
        message: `${action} node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle node state'
      };
    }
  }
};