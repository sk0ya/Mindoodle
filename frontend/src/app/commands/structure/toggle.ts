/**
 * Toggle Command
 * Toggles the collapse state of a node's children (equivalent to vim 'za')
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';

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
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const forceState = (args as any)['expand'];

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

/**
 * Expand Command (vim 'zo')
 * Expand the selected node's children
 */
export const expandCommand: Command = {
  name: 'expand',
  aliases: ['zo', 'open-fold'],
  description: 'Expand the selected node to show its children',
  category: 'structure',
  examples: ['expand', 'zo'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    if (!node.children || node.children.length === 0) {
      return {
        success: false,
        error: `Node "${node.text}" has no children to expand`
      };
    }

    if (!node.collapsed) {
      return {
        success: true,
        message: `Node "${node.text}" is already expanded`
      };
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: false });
      return {
        success: true,
        message: `Expanded node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to expand node'
      };
    }
  }
};

/**
 * Collapse Command (vim 'zc')
 * Collapse the selected node's children
 */
export const collapseCommand: Command = {
  name: 'collapse',
  aliases: ['zc', 'close-fold'],
  description: 'Collapse the selected node to hide its children',
  category: 'structure',
  examples: ['collapse', 'zc'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    if (!node.children || node.children.length === 0) {
      return {
        success: false,
        error: `Node "${node.text}" has no children to collapse`
      };
    }

    if (node.collapsed) {
      return {
        success: true,
        message: `Node "${node.text}" is already collapsed`
      };
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: true });
      return {
        success: true,
        message: `Collapsed node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to collapse node'
      };
    }
  }
};

/**
 * Expand All Command (vim 'zR')
 * Expand all nodes in the mindmap
 */
export const expandAllCommand: Command = {
  name: 'expand-all',
  aliases: ['zR', 'open-all-folds'],
  description: 'Expand all nodes in the mindmap',
  category: 'structure',
  examples: ['expand-all', 'zR'],

  execute(context: CommandContext): CommandResult {
    try {
      // Get all nodes from store
      const state = useMindMapStore.getState() as any;
      const rootNodes = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        return {
          success: false,
          error: 'No nodes found in current mindmap'
        };
      }

      let expandedCount = 0;

      // Recursive function to expand all nodes
      function expandAllNodes(nodes: any[]): void {
        for (const node of nodes) {
          if (node.children && node.children.length > 0 && node.collapsed) {
            context.handlers.updateNode(node.id, { collapsed: false });
            expandedCount++;
          }
          if (node.children) {
            expandAllNodes(node.children);
          }
        }
      }

      expandAllNodes(rootNodes);

      return {
        success: true,
        message: `Expanded all nodes (${expandedCount} nodes were collapsed)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to expand all nodes'
      };
    }
  }
};

/**
 * Collapse All Command (vim 'zM')
 * Collapse all nodes in the mindmap
 */
export const collapseAllCommand: Command = {
  name: 'collapse-all',
  aliases: ['zM', 'close-all-folds'],
  description: 'Collapse all nodes in the mindmap',
  category: 'structure',
  examples: ['collapse-all', 'zM'],

  execute(context: CommandContext): CommandResult {
    try {
      // Get all nodes from store
      const state = useMindMapStore.getState() as any;
      const rootNodes = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        return {
          success: false,
          error: 'No nodes found in current mindmap'
        };
      }

      let collapsedCount = 0;

      // Recursive function to collapse all nodes
      function collapseAllNodes(nodes: any[]): void {
        for (const node of nodes) {
          if (node.children && node.children.length > 0 && !node.collapsed) {
            context.handlers.updateNode(node.id, { collapsed: true });
            collapsedCount++;
          }
          if (node.children) {
            collapseAllNodes(node.children);
          }
        }
      }

      collapseAllNodes(rootNodes);

      return {
        success: true,
        message: `Collapsed all nodes (${collapsedCount} nodes were expanded)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to collapse all nodes'
      };
    }
  }
};
