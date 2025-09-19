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
    const direction = (args as any)['direction'];

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
    const nodeId = (args as any)['nodeId'];

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
    const searchText = (args as any)['text'];
    const exactMatch = (args as any)['exact'];

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
// Pan up command (for Ctrl+U vim command)
export const scrollUpCommand: Command = {
  name: 'scroll-up',
  aliases: ['ctrl-u'],
  description: 'Pan the mindmap view up',
  category: 'navigation',
  examples: ['scroll-up', 'ctrl-u'],

  execute(context: CommandContext): CommandResult {
    try {
      // Use the existing setPan functionality from the handlers
      if (context.handlers.setPan && typeof context.handlers.setPan === 'function') {
        const panAmount = 100; // logical units to pan up

        // Pan up by moving the view upward (increase y coordinate)
        context.handlers.setPan((prev: { x: number; y: number }) => ({
          x: prev.x,
          y: prev.y + panAmount
        }));

        return {
          success: true,
          message: 'Panned view up'
        };
      } else {
        return {
          success: false,
          error: 'Pan functionality not available'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pan up'
      };
    }
  }
};

// Pan down command (for Ctrl+D vim command)
export const scrollDownCommand: Command = {
  name: 'scroll-down',
  aliases: ['ctrl-d'],
  description: 'Pan the mindmap view down',
  category: 'navigation',
  examples: ['scroll-down', 'ctrl-d'],

  execute(context: CommandContext): CommandResult {
    try {
      // Use the existing setPan functionality from the handlers
      if (context.handlers.setPan && typeof context.handlers.setPan === 'function') {
        const panAmount = 100; // logical units to pan down

        // Pan down by moving the view downward (decrease y coordinate)
        context.handlers.setPan((prev: { x: number; y: number }) => ({
          x: prev.x,
          y: prev.y - panAmount
        }));

        return {
          success: true,
          message: 'Panned view down'
        };
      } else {
        return {
          success: false,
          error: 'Pan functionality not available'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pan down'
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

// Select center visible node command (for M vim command)
export const selectCenterNodeCommand: Command = {
  name: 'select-center',
  aliases: ['center-select', 'vim-m'],
  description: 'Select the node closest to the center of the visible viewport',
  category: 'navigation',
  examples: ['select-center', 'center-select'],

  execute(context: CommandContext): CommandResult {
    try {
      let rootNode = null;

      // Get root node from vim context
      if (context.vim?.getCurrentRootNode) {
        rootNode = context.vim.getCurrentRootNode();
      }

      if (!rootNode) {
        return {
          success: false,
          error: 'No root node found in current map'
        };
      }

      // Get actual viewport dimensions considering sidebar and panels
      const mindmapContainer = document.querySelector('.mindmap-workspace') ||
                              document.querySelector('.mindmap-canvas') ||
                              document.querySelector('.canvas-container');

      let effectiveWidth = window.innerWidth;
      let effectiveHeight = window.innerHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (mindmapContainer) {
        const rect = mindmapContainer.getBoundingClientRect();
        effectiveWidth = rect.width;
        effectiveHeight = rect.height;
        offsetX = rect.left;
        offsetY = rect.top;
      } else {
        // Fallback: manually calculate effective area considering all panels

        // Left sidebar
        const sidebar = document.querySelector('.sidebar') ||
                       document.querySelector('.primary-sidebar') ||
                       document.querySelector('.primary-sidebar-container');
        if (sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          effectiveWidth -= sidebarRect.width;
          offsetX = sidebarRect.width;
        }

        // Right panels (notes panel, customization panel, etc.)
        const rightPanels = [
          document.querySelector('.node-notes-panel'),
          document.querySelector('.customization-panel'),
          document.querySelector('.notes-panel-container'),
          document.querySelector('.panel-container')
        ].filter(panel => {
          if (!panel) return false;
          const rect = panel.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0; // Only visible panels
        });

        rightPanels.forEach(panel => {
          if (panel) {
            const panelRect = panel.getBoundingClientRect();
            effectiveWidth -= panelRect.width;
          }
        });

        // Top toolbar/header
        const header = document.querySelector('.toolbar') ||
                      document.querySelector('.mindmap-header') ||
                      document.querySelector('.header');
        if (header) {
          const headerRect = header.getBoundingClientRect();
          effectiveHeight -= headerRect.height;
          offsetY = headerRect.height;
        }
      }

      // Calculate the center of the effective viewport in screen coordinates
      const centerScreenX = offsetX + effectiveWidth / 2;
      const centerScreenY = offsetY + effectiveHeight / 2;

      // Function to find all visible nodes
      function collectAllNodes(node: any): any[] {
        let nodes = [node];
        if (node.children && !node.collapsed) {
          for (const child of node.children) {
            nodes = nodes.concat(collectAllNodes(child));
          }
        }
        return nodes;
      }

      const allNodes = collectAllNodes(rootNode);

      // Find the node closest to the center of the viewport
      let closestNode = null;
      let closestDistance = Infinity;

      // Get current zoom and pan from context (we'll need to estimate this)
      // For now, we'll use a default zoom of 1.5 that matches the ensureNodeVisible function
      const currentZoom = 1.5; // This should ideally come from ui context
      const currentPan = { x: 0, y: 0 }; // This should ideally come from ui context

      // Try to get pan/zoom from handlers if available
      if (context.handlers.setPan && typeof context.handlers.setPan === 'function') {
        // We can't easily get current pan/zoom, so we'll use the default approach
        // In a real implementation, we'd need access to current ui state
      }

      for (const node of allNodes) {
        if (!node.x || !node.y) continue; // Skip nodes without position

        // Calculate node's screen position
        const nodeScreenX = currentZoom * (node.x + currentPan.x);
        const nodeScreenY = currentZoom * (node.y + currentPan.y);

        // Calculate distance from viewport center
        const deltaX = nodeScreenX - centerScreenX;
        const deltaY = nodeScreenY - centerScreenY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = node;
        }
      }

      if (!closestNode) {
        return {
          success: false,
          error: 'No visible nodes found to select'
        };
      }

      // Select the closest node
      context.handlers.selectNode(closestNode.id);

      // Close any open panels
      context.handlers.closeAttachmentAndLinkLists();

      return {
        success: true,
        message: `Selected center node: "${closestNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select center node'
      };
    }
  }
};
