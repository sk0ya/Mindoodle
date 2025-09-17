/**
 * Structure Commands
 * Commands for creating and manipulating node structure
 */

import type { Command, CommandContext, CommandResult } from '../types';

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
    const parentId = args.parentId || context.selectedNodeId;
    const text = args.text || '';
    const startEdit = args.edit ?? true;

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
    const nodeId = args.nodeId || context.selectedNodeId;
    const text = args.text || '';
    const startEdit = args.edit ?? true;

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
    const nodeId = args.nodeId || context.selectedNodeId;
    let targetType = args.type as 'heading' | 'unordered-list' | 'ordered-list';

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

    // For vim 'm' behavior: toggle between heading and list when no specific type is provided
    if (!args.type) {
      if (node.markdownMeta?.type === 'heading') {
        // 見出し → リスト
        targetType = 'unordered-list';
      } else if (node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list') {
        // リスト → 見出し
        targetType = 'heading';
      } else {
        return {
          success: false,
          error: 'Can only convert between heading and list nodes'
        };
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