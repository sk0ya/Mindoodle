

import type { Command, CommandContext, CommandResult, Direction } from '../system/types';
import type { MindMapNode, UIState } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { viewportService } from '@/app/core/services';

type ArgValue = string | number | boolean;
type ArgsMap = Record<string, ArgValue>;


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

  execute(context: CommandContext, args: ArgsMap): CommandResult {
    const direction = typeof args['direction'] === 'string' ? args['direction'] : '';

    if (!context.selectedNodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    const isDirection = (d: string): d is Direction => (
      (['up', 'down', 'left', 'right'] as const).includes(d as Direction)
    );
    if (!isDirection(direction)) {
      return {
        success: false,
        error: `Invalid direction "${direction}". Use: up, down, left, right`
      };
    }

    try {
      context.handlers.closeAttachmentAndLinkLists();
      context.handlers.navigateToDirection(direction);
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

  execute(context: CommandContext, args: ArgsMap): CommandResult {
    const nodeId = typeof args['nodeId'] === 'string' ? args['nodeId'] : '';

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      
      
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

  execute(_context: CommandContext, args: ArgsMap): CommandResult {
    const searchText = typeof args['text'] === 'string' ? args['text'] : '';
    const exactMatch = typeof args['exact'] === 'boolean' ? args['exact'] : false;

    try {
      
      
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


export const zoomInCommand: Command = {
  name: 'zoom-in',
  aliases: ['zoom+', 'zi'],
  description: 'Zoom in on the mindmap',
  category: 'navigation',
  examples: ['zoom-in', 'zoom+', 'zi'],

  execute(): CommandResult {
    
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
    
    return {
      success: true,
      message: 'Reset zoom to fit (Zoom API needs implementation)'
    };
  }
};



export const scrollUpCommand: Command = {
  name: 'scroll-up',
  aliases: ['ctrl-u'],
  description: 'Pan the mindmap view up',
  category: 'navigation',
  examples: ['scroll-up', 'ctrl-u'],

  execute(context: CommandContext): CommandResult {
    try {
      
      if (context.handlers.setPan && typeof context.handlers.setPan === 'function') {
        const panAmount = 100; 

        
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


export const scrollDownCommand: Command = {
  name: 'scroll-down',
  aliases: ['ctrl-d'],
  description: 'Pan the mindmap view down',
  category: 'navigation',
  examples: ['scroll-down', 'ctrl-d'],

  execute(context: CommandContext): CommandResult {
    try {
      
      if (context.handlers.setPan && typeof context.handlers.setPan === 'function') {
        const panAmount = 100; 

        
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


export const selectRootNodeCommand: Command = {
  name: 'select-root',
  aliases: ['root', 'go-root', 'gg'],
  description: 'Select and center the root node',
  category: 'navigation',
  examples: ['select-root', 'root', 'gg'],

  execute(context: CommandContext): CommandResult {
    try {
      const roots: MindMapNode[] = useMindMapStore.getState()?.data?.rootNodes || [];
      if (!roots || roots.length === 0) {
        return {
          success: false,
          error: 'No root nodes found in current map'
        };
      }
      const rootNode = roots[0];

      
      context.handlers.selectNode(rootNode.id);

      
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(rootNode.id, true);
      }

      
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


function calculateMapAreaRect(ui: UIState): DOMRect {
  const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();
  const ACTIVITY_BAR_WIDTH = 48;
  const SIDEBAR_WIDTH = 280;
  const leftPanelWidth = ACTIVITY_BAR_WIDTH + (ui?.activeView && !ui?.sidebarCollapsed ? SIDEBAR_WIDTH : 0);
  const rightPanelWidth = ui?.showNotesPanel ? ((ui?.markdownPanelWidth as number) || 0) : 0;
  const VIM_HEIGHT = 24;
  const defaultNoteHeight = viewportService.getDefaultNoteHeight();
  let noteHeight = 0;
  if (ui?.showNodeNotePanel) {
    noteHeight = (ui?.nodeNotePanelHeight && (ui?.nodeNotePanelHeight) > 0) ? (ui?.nodeNotePanelHeight) : defaultNoteHeight;
  }
  const bottomOverlay = Math.max(noteHeight, VIM_HEIGHT);
  const topOverlay = 0;
  return new DOMRect(
    leftPanelWidth,
    topOverlay,
    Math.max(0, viewportWidth - leftPanelWidth - rightPanelWidth),
    Math.max(0, viewportHeight - bottomOverlay - topOverlay)
  );
}

function collectAllNodes(node: MindMapNode): MindMapNode[] {
  let nodes = [node];
  if (node.children && !node.collapsed) {
    for (const child of node.children) {
      nodes = nodes.concat(collectAllNodes(child));
    }
  }
  return nodes;
}

function findClosestNodeToCenter(
  allNodes: MindMapNode[],
  centerX: number,
  centerY: number,
  zoom: number,
  pan: { x: number; y: number }
): MindMapNode | null {
  let closestNode = null;
  let closestDistance = Infinity;

  for (const node of allNodes) {
    if (!node.x || !node.y) continue;

    const nodeScreenX = zoom * (node.x + pan.x);
    const nodeScreenY = zoom * (node.y + pan.y);

    const deltaX = nodeScreenX - centerX;
    const deltaY = nodeScreenY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestNode = node;
    }
  }

  return closestNode;
}

export const selectCenterNodeCommand: Command = {
  name: 'select-center',
  aliases: ['center-select', 'vim-m'],
  description: 'Select the node closest to the center of the visible viewport',
  category: 'navigation',
  examples: ['select-center', 'center-select'],

  execute(context: CommandContext): CommandResult {
    try {
      const st = useMindMapStore.getState();
      const ui = st?.ui || {};
      const mapAreaRect = calculateMapAreaRect(ui);

      const centerScreenX = mapAreaRect.left + (mapAreaRect.width / 2);
      const centerScreenY = mapAreaRect.top + (mapAreaRect.height / 2);

      const rootsForCollect: MindMapNode[] = st?.data?.rootNodes || [];
      const allNodes: MindMapNode[] = ([] as MindMapNode[]).concat(...rootsForCollect.map((r: MindMapNode) => collectAllNodes(r)));

      const currentZoom = (ui?.zoom || 1) * 1.5;
      const currentPan = ui?.pan || { x: 0, y: 0 };

      const closestNode = findClosestNodeToCenter(allNodes, centerScreenX, centerScreenY, currentZoom, currentPan);

      if (!closestNode) {
        return {
          success: false,
          error: 'No visible nodes found to select'
        };
      }

      context.handlers.selectNode(closestNode.id);
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(closestNode.id, true);
      }

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


export const selectBottomNodeCommand: Command = {
  name: 'select-bottom',
  aliases: ['vim-G', 'G'],
  description: 'Select the visible node positioned lowest in the map',
  category: 'navigation',
  examples: ['select-bottom', 'G'],

  execute(context: CommandContext): CommandResult {
    try {
      const roots: MindMapNode[] = useMindMapStore.getState()?.data?.rootNodes || [];
      if (!roots || roots.length === 0) {
        return { success: false, error: 'No root nodes found in current map' };
      }
      
      const rootNode = roots[roots.length - 1];

      
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


export const nextMapCommand: Command = {
  name: 'next-map',
  description: 'Switch to the next map in the workspace (vim gt)',
  category: 'navigation',
  execute: async (context: CommandContext) => {
    try {

      const handlers = context.handlers;
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


export const prevMapCommand: Command = {
  name: 'prev-map',
  description: 'Switch to the previous map in the workspace (vim gT)',
  category: 'navigation',
  execute: async (context: CommandContext) => {
    try {

      const handlers = context.handlers;
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
      const state = useMindMapStore.getState();
      const rootNodes = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        return {
          success: false,
          error: 'No root nodes found in current map'
        };
      }



      function findRootNodeForNode(nodeId: string, nodes: MindMapNode[]): MindMapNode | null {
        for (const node of nodes) {
          if (node.id === nodeId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findRootNodeForNode(nodeId, node.children);
            if (found) {
              return node; 
            }
          }
        }
        return null;
      }



      const isAlreadyRoot = rootNodes.some((root: MindMapNode) => root.id === selectedNodeId);

      if (isAlreadyRoot) {
        return {
          success: true,
          message: 'Already at root node'
        };
      }

      
      const containingRootNode = findRootNodeForNode(selectedNodeId, rootNodes);

      if (!containingRootNode) {
        return {
          success: false,
          error: 'Could not find root node for selected node'
        };
      }

      
      context.handlers.selectNode(containingRootNode.id);

      
      if (context.handlers.centerNodeInView) {
        context.handlers.centerNodeInView(containingRootNode.id, true);
      }

      
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
