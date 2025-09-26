/**
 * Structure Commands
 * Commands for creating and manipulating node structure
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

// Add child node command (vim Tab/o)
export const addChildCommand: Command = {
  name: 'add-child',
  aliases: ['child', 'tab'],
  description: 'Add a new child node to the selected node',
  category: 'structure',
  examples: [
    'add-child',
    'child',
    'tab',
    'add-child --text "Child text"',
    'add-child --edit'
  ],
  args: [
    {
      name: 'parentId',
      type: 'node-id',
      required: false,
      description: 'Parent node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new child node'
    },
    {
      name: 'edit',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Start editing the new node immediately'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const parentId = (args as any)['parentId'] || context.selectedNodeId;
    const text = (args as any)['text'] || '';
    const startEdit = (args as any)['edit'] ?? true;

    if (!parentId) {
      return {
        success: false,
        error: 'No node selected and no parent ID provided'
      };
    }

    const parentNode = context.handlers.findNodeById(parentId);
    if (!parentNode) {
      return {
        success: false,
        error: `Parent node ${parentId} not found`
      };
    }

    try {
      const newNodeId = await context.handlers.addChildNode(parentId, text, startEdit);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new child node'
        };
      }

      return {
        success: true,
        message: `Added child node to "${parentNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add child node'
      };
    }
  }
};

// Add sibling node command (vim Enter)
export const addSiblingCommand: Command = {
  name: 'add-sibling',
  aliases: ['sibling', 'enter'],
  description: 'Add a new sibling node after the selected node',
  category: 'structure',
  examples: [
    'add-sibling',
    'sibling',
    'enter',
    'add-sibling --text "Sibling text"',
    'add-sibling --edit'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Reference node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new sibling node'
    },
    {
      name: 'edit',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Start editing the new node immediately'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const text = (args as any)['text'] || '';
    const startEdit = (args as any)['edit'] ?? true;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    const referenceNode = context.handlers.findNodeById(nodeId);
    if (!referenceNode) {
      return {
        success: false,
        error: `Reference node ${nodeId} not found`
      };
    }

    try {
      const newNodeId = await context.handlers.addSiblingNode(nodeId, text, startEdit);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new sibling node'
        };
      }

      return {
        success: true,
        message: `Added sibling node after "${referenceNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add sibling node'
      };
    }
  }
};

// Convert heading to list command (vim m)
export const convertNodeCommand: Command = {
  name: 'convert',
  aliases: ['m', 'convert-type'],
  description: 'Convert node type (e.g., heading to list)',
  category: 'structure',
  examples: [
    'convert',
    'm',
    'convert --type unordered-list',
    'convert node-123 --type heading'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to convert (uses selected node if not specified)'
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'Target type: heading, unordered-list, ordered-list'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    let targetType = (args as any)['type'] as 'heading' | 'unordered-list' | 'ordered-list';

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

    // Check if onMarkdownNodeType handler is available
    if (!context.handlers.onMarkdownNodeType) {
      return {
        success: false,
        error: 'Node type conversion is not available'
      };
    }

    // For vim 'm' behavior (no explicit type):
    // - heading -> unordered-list
    // - ordered-list -> unordered-list (番号付き → 箇条書き)
    // - unordered-list -> heading
    // - unknown -> unordered-list
    if (!args.type) {
      const currentType = node.markdownMeta?.type;
      if (currentType === 'heading') {
        targetType = 'unordered-list';
      } else if (currentType === 'ordered-list') {
        targetType = 'unordered-list';
      } else if (currentType === 'unordered-list') {
        targetType = 'heading';
      } else {
        targetType = 'unordered-list';
      }
    }

    try {
      context.handlers.onMarkdownNodeType(nodeId, targetType);
      return {
        success: true,
        message: `Converted "${node.text}" to ${targetType}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert node type'
      };
    }
  }
};

// Move selected node as child of its previous sibling command (vim >>)
export const moveAsChildOfSiblingCommand: Command = {
  name: 'move-as-child-of-sibling',
  aliases: ['>>'],
  description: 'Move the selected node as a child of its previous sibling',
  category: 'structure',
  examples: [
    'move-as-child-of-sibling',
    '>>'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to move (uses selected node if not specified)'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;

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

    try {
      // Get the parent node using findParentNode if available
      if (!context.handlers.findParentNode) {
        return {
          success: false,
          error: 'Parent node lookup is not available'
        };
      }

      const parentNode = context.handlers.findParentNode(nodeId);
      if (!parentNode) {
        return {
          success: false,
          error: 'Cannot move root node as child of sibling'
        };
      }

      const siblings = parentNode.children || [];
      const currentIndex = siblings.findIndex((sibling: any) => sibling.id === nodeId);
      
      if (currentIndex <= 0) {
        return {
          success: false,
          error: 'No previous sibling to move under'
        };
      }

      const previousSibling = siblings[currentIndex - 1];
      
      // Use the moveNode function to move the node
      if (!context.handlers.moveNode) {
        return {
          success: false,
          error: 'Move node functionality is not available'
        };
      }

      await context.handlers.moveNode(nodeId, previousSibling.id);

      return {
        success: true,
        message: `Moved "${node.text}" as child of "${previousSibling.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move node'
      };
    }
  }
};
// Move selected node as next sibling of its parent command (vim <<)
export const moveAsNextSiblingOfParentCommand: Command = {
  name: 'move-as-next-sibling-of-parent',
  aliases: ['<<'],
  description: 'Move the selected node as the next sibling of its parent',
  category: 'structure',
  examples: [
    'move-as-next-sibling-of-parent',
    '<<'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to move (uses selected node if not specified)'
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;

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

    try {
      // Get the parent node using findParentNode if available
      if (!context.handlers.findParentNode) {
        return {
          success: false,
          error: 'Parent node lookup is not available'
        };
      }

      const parentNode = context.handlers.findParentNode(nodeId);
      if (!parentNode) {
        return {
          success: false,
          error: 'Cannot move root node - no parent exists'
        };
      }

      // Use moveNodeWithPosition to position the node as 'after' its parent
      if (!context.handlers.moveNodeWithPosition) {
        return {
          success: false,
          error: 'Move node with position functionality is not available'
        };
      }

      await context.handlers.moveNodeWithPosition(nodeId, parentNode.id, 'after');

      return {
        success: true,
        message: `Moved "${node.text}" as next sibling of "${parentNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move node'
      };
    }
  }
};
