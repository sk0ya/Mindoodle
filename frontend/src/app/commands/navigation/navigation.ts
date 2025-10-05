/**
 * Navigation Commands
 * All node navigation and selection operations
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';
import { viewportService } from '@/app/core/services';

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
    // This would require implementing zoom controls
    return {
      success: true,
      message: 'Zoomed in (Zoom API needs implementation)'
    };
  }
};

export const zoomOutCommand: Command = {
  name: 'zoom-out',
  aliases: ['zoom-'],
  description: 'Zoom out on the mindmap',
  category: 'navigation',
  examples: ['zoom-out', 'zoom-'],

  execute(): CommandResult {
    // This would require implementing zoom controls
    return {
      success: true,
      message: 'Zoomed out (Zoom API needs implementation)'
    };
  }
};

export const zoomResetCommand: Command = {
  name: 'zoom-reset',
  aliases: ['zoom-fit', 'fit'],
  description: 'Reset zoom to fit all nodes',
  category: 'navigation',
  examples: ['zoom-reset', 'fit', 'zoom-fit'],

  execute(): CommandResult {
    // This would require implementing zoom controls
    return {
      success: true,
      message: 'Reset zoom to fit (Zoom API needs implementation)'
    };
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
      const roots = (useMindMapStore.getState() as any)?.data?.rootNodes || [];
      if (!roots || roots.length === 0) {
        return {
          success: false,
          error: 'No root nodes found in current map'
        };
      }
      const rootNode = roots[0];

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

      // Compute viewport rect like centerNodeInView
      const st = (useMindMapStore.getState() as any);
      const ui = st?.ui || {};
      const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();
      const ACTIVITY_BAR_WIDTH = 48;
      const SIDEBAR_WIDTH = 280;
      const leftPanelWidth = ACTIVITY_BAR_WIDTH + (ui?.activeView && !ui?.sidebarCollapsed ? SIDEBAR_WIDTH : 0);
      const rightPanelWidth = ui?.showNotesPanel ? (ui?.markdownPanelWidth || 0) : 0;
      const VIM_HEIGHT = 24;
      const defaultNoteHeight = viewportService.getDefaultNoteHeight();
      const noteHeight = ui?.showNodeNotePanel ? (ui?.nodeNotePanelHeight && ui?.nodeNotePanelHeight > 0 ? ui?.nodeNotePanelHeight : defaultNoteHeight) : 0;
      const bottomOverlay = Math.max(noteHeight, VIM_HEIGHT);
      const topOverlay = 0;
      const mapAreaRect = new DOMRect(
        leftPanelWidth,
        topOverlay,
        Math.max(0, viewportWidth - leftPanelWidth - rightPanelWidth),
        Math.max(0, viewportHeight - bottomOverlay - topOverlay)
      );

      // Center of effective viewport (screen coords)
      const centerScreenX = mapAreaRect.left + (mapAreaRect.width / 2);
      const centerScreenY = mapAreaRect.top + (mapAreaRect.height / 2);

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

      // Gather nodes from all roots so selection considers the full map
      const st2 = (useMindMapStore.getState() as any);
      const rootsForCollect = st2?.data?.rootNodes || [];
      const allNodes = ([] as any[]).concat(...rootsForCollect.map((r: any) => collectAllNodes(r)));

      // Find the node closest to the center of the viewport
      let closestNode = null;
      let closestDistance = Infinity;

      // Use actual zoom/pan from UI store for accurate screen positions
      const currentZoom = ((ui?.zoom) || 1) * 1.5; // match renderer scale
      const currentPan = ui?.pan || { x: 0, y: 0 };

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

      // Select the closest node and bring it into view
      context.handlers.selectNode(closestNode.id);
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(closestNode.id, true);
      }

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

// Select bottom-most visible node command (for Vim 'G')
export const selectBottomNodeCommand: Command = {
  name: 'select-bottom',
  aliases: ['vim-G', 'G'],
  description: 'Select the visible node positioned lowest in the map',
  category: 'navigation',
  examples: ['select-bottom', 'G'],

  execute(context: CommandContext): CommandResult {
    try {
      const roots = (useMindMapStore.getState() as any)?.data?.rootNodes || [];
      if (!roots || roots.length === 0) {
        return { success: false, error: 'No root nodes found in current map' };
      }
      // Start from the bottom-most root (last in order)
      const rootNode = roots[roots.length - 1];

      // Pick the deepest descendant by always choosing the last child until leaf
      let bottom = rootNode;
      while (bottom && Array.isArray(bottom.children) && bottom.children.length > 0) {
        bottom = bottom.children[bottom.children.length - 1];
      }

      if (!bottom || !bottom.id) {
        return { success: false, error: 'No nodes to select' };
      }

      context.handlers.selectNode(bottom.id);
      context.handlers.closeAttachmentAndLinkLists();
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(bottom.id, true);
      }
      return { success: true, message: `Selected bottom node: "${bottom.text}"` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to select bottom node' };
    }
  }
};

/**
 * Command to switch to next map (vim-style gt)
 * Uses existing switchToNextMap functionality
 */
export const nextMapCommand: Command = {
  name: 'next-map',
  description: 'Switch to the next map in the workspace (vim gt)',
  category: 'navigation',
  execute: async (context: CommandContext) => {
    try {
      // Use the existing switchToNextMap functionality
      const handlers = (context as any).handlers;
      if (handlers && handlers.switchToNextMap) {
        handlers.switchToNextMap();
        return { success: true, message: 'Switched to next map' };
      }

      return { success: false, error: 'Map switching not available' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to switch to next map' };
    }
  }
};

/**
 * Command to switch to previous map (vim-style gT)
 * Uses existing switchToPrevMap functionality
 */
export const prevMapCommand: Command = {
  name: 'prev-map',
  description: 'Switch to the previous map in the workspace (vim gT)',
  category: 'navigation',
  execute: async (context: CommandContext) => {
    try {
      // Use the existing switchToPrevMap functionality
      const handlers = (context as any).handlers;
      if (handlers && handlers.switchToPrevMap) {
        handlers.switchToPrevMap();
        return { success: true, message: 'Switched to previous map' };
      }

      return { success: false, error: 'Map switching not available' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to switch to previous map' };
    }
  }
};

/**
 * Command to select the root node of current selected node (vim '0')
 * Finds and selects the root node that contains the currently selected node
 */
export const selectCurrentRootCommand: Command = {
  name: 'select-current-root',
  aliases: ['0', 'current-root'],
  description: 'Select the root node of the currently selected node',
  category: 'navigation',
  examples: ['select-current-root', '0'],

  execute(context: CommandContext): CommandResult {
    const selectedNodeId = context.selectedNodeId;

    if (!selectedNodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    try {
      const state = useMindMapStore.getState() as any;
      const rootNodes = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        return {
          success: false,
          error: 'No root nodes found in current map'
        };
      }

      // Find the root node that contains the selected node
      function findRootNodeForNode(nodeId: string, nodes: any[]): any | null {
        for (const node of nodes) {
          if (node.id === nodeId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findRootNodeForNode(nodeId, node.children);
            if (found) {
              return node; // Return the root node, not the found child
            }
          }
        }
        return null;
      }

      // Check if the selected node is already a root node
      const isAlreadyRoot = rootNodes.some((root: any) => root.id === selectedNodeId);

      if (isAlreadyRoot) {
        return {
          success: true,
          message: 'Already at root node'
        };
      }

      // Find which root node contains the selected node
      const containingRootNode = findRootNodeForNode(selectedNodeId, rootNodes);

      if (!containingRootNode) {
        return {
          success: false,
          error: 'Could not find root node for selected node'
        };
      }

      // Select the root node
      context.handlers.selectNode(containingRootNode.id);

      // Center the root node in view with animation
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(containingRootNode.id, true);
      }

      // Close any open panels
      context.handlers.closeAttachmentAndLinkLists();

      return {
        success: true,
        message: `Selected root node: "${containingRootNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select current root node'
      };
    }
  }
};
