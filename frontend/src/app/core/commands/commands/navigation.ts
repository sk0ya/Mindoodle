/**
 * Navigation Commands
 * All node navigation and selection operations
 */

import type { Command, CommandContext, CommandResult } from '../types';

// Arrow navigation command
export const arrowNavigateCommand: Command = {
  name: 'arrow-navigate',
  aliases: ['arrow'],
  description: 'Navigate using arrow keys',
  category: 'navigation',
  examples: ['arrow-navigate up', 'arrow up', 'arrow-navigate down'],
  args: [
    {
      name: 'direction',
      type: 'string',
      required: true,
      description: 'Direction: up, down, left, right'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const direction = args.direction;

    if (!context.selectedNodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const validDirections = ['up', 'down', 'left', 'right'];
    if (!validDirections.includes(direction)) {
      return {
        success: false,
        error: `Invalid direction "${direction}". Use: ${validDirections.join(', ')}`
      };
    }

    try {
      context.handlers.closeAttachmentAndLinkLists();
      context.handlers.navigateToDirection(direction as 'up' | 'down' | 'left' | 'right');
      return {
        success: true,
        message: `Navigated ${direction}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to navigate ${direction}`
      };
    }
  }
};

// Focus/select node command
export const selectNodeCommand: Command = {
  name: 'select-node',
  aliases: ['select', 'focus'],
  description: 'Select a specific node by ID',
  category: 'navigation',
  examples: ['select-node node-123', 'select node-456', 'focus node-789'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: true,
      description: 'Node ID to select'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = args.nodeId;

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      // This would require extending the handlers interface
      // For now, we'll note this as a potential enhancement
      return {
        success: true,
        message: `Selected node "${node.text}" (Note: Direct node selection API needs implementation)`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select node'
      };
    }
  }
};

// Find node command
export const findNodeCommand: Command = {
  name: 'find-node',
  aliases: ['find', 'search'],
  description: 'Find a node by text content',
  category: 'navigation',
  examples: ['find-node "hello world"', 'find hello', 'search text'],
  args: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'Text to search for'
    },
    {
      name: 'exact',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Exact match instead of partial'
    }
  ],

  execute(_context: CommandContext, args: Record<string, any>): CommandResult {
    const searchText = args.text;
    const exactMatch = args.exact;

    try {
      // This would require implementing a search function
      // For now, we'll note this as a feature to implement
      return {
        success: true,
        message: `Search for "${searchText}" (${exactMatch ? 'exact' : 'partial'} match) - Search API needs implementation`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search'
      };
    }
  }
};

// Zoom commands
export const zoomInCommand: Command = {
  name: 'zoom-in',
  aliases: ['zoom+', 'zi'],
  description: 'Zoom in on the mindmap',
  category: 'navigation',
  examples: ['zoom-in', 'zoom+', 'zi'],

  execute(): CommandResult {
    try {
      // This would require implementing zoom controls
      return {
        success: true,
        message: 'Zoomed in (Zoom API needs implementation)'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to zoom in'
      };
    }
  }
};

export const zoomOutCommand: Command = {
  name: 'zoom-out',
  aliases: ['zoom-', 'zo'],
  description: 'Zoom out on the mindmap',
  category: 'navigation',
  examples: ['zoom-out', 'zoom-', 'zo'],

  execute(): CommandResult {
    try {
      // This would require implementing zoom controls
      return {
        success: true,
        message: 'Zoomed out (Zoom API needs implementation)'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to zoom out'
      };
    }
  }
};

export const zoomResetCommand: Command = {
  name: 'zoom-reset',
  aliases: ['zoom-fit', 'fit'],
  description: 'Reset zoom to fit all nodes',
  category: 'navigation',
  examples: ['zoom-reset', 'fit', 'zoom-fit'],

  execute(): CommandResult {
    try {
      // This would require implementing zoom controls
      return {
        success: true,
        message: 'Reset zoom to fit (Zoom API needs implementation)'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset zoom'
      };
    }
  }
};

// Select root node command (for gg vim command)
export const selectRootNodeCommand: Command = {
  name: 'select-root',
  aliases: ['root', 'go-root', 'gg'],
  description: 'Select and center the root node',
  category: 'navigation',
  examples: ['select-root', 'root', 'gg'],

  execute(context: CommandContext): CommandResult {
    try {
      let rootNode = null;

      // Try to get root node from vim context first
      if (context.vim?.getCurrentRootNode) {
        rootNode = context.vim.getCurrentRootNode();
      }

      // If no root node found or no vim context, this is still a failure
      // The vim context should always be available and have the root node
      if (!rootNode || !rootNode.id) {
        return {
          success: false,
          error: 'No root node found in current map'
        };
      }

      // Select the root node
      context.handlers.selectNode(rootNode.id);

      // Center the root node in view with animation
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(rootNode.id, true);
      }

      // Close any open panels
      context.handlers.closeAttachmentAndLinkLists();

      return {
        success: true,
        message: `Selected root node: "${rootNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select root node'
      };
    }
  }
};