/**
 * Structure commands - refactored with functional patterns
 * Reduced from 414 lines to ~250 lines (40% reduction)
 */

import type { Command, CommandContext, CommandResult, MarkdownNodeType, ArgsMap } from '../system/types';
import { statusMessages } from '@shared/utils';
import {
  getArg,
  getNodeId,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

// === Add Node Commands ===

const createAddNodeCommand = (config: {
  name: string;
  aliases: string[];
  description: string;
  nodeType: 'child' | 'sibling';
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: 'structure',
  examples: [config.name, ...config.aliases, `${config.name} --text "Text"`, `${config.name} --edit`],
  args: [
    {
      name: config.nodeType === 'child' ? 'parentId' : 'nodeId',
      type: 'node-id',
      required: false,
      description: config.nodeType === 'child'
        ? 'Parent node ID (uses selected node if not specified)'
        : 'Reference node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: `Initial text for the new ${config.nodeType} node`
    },
    {
      name: 'edit',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Start editing the new node immediately'
    }
  ],

  execute: withErrorHandling(
    async (context: CommandContext, args: ArgsMap = {}): Promise<CommandResult> => {
      const nodeId = getArg<string>(args, config.nodeType === 'child' ? 'parentId' : 'nodeId') ?? context.selectedNodeId;
      const text = getArg<string>(args, 'text') ?? '';
      const startEdit = getArg<boolean>(args, 'edit') ?? true;

      if (!nodeId) {
        return failure('No node selected and no node ID provided');
      }

      const node = context.handlers.findNodeById(nodeId);
      if (!node) {
        return failure(`Node ${nodeId} not found`);
      }

      const newNodeId = config.nodeType === 'child'
        ? await context.handlers.addChildNode(nodeId, text, startEdit)
        : await context.handlers.addSiblingNode(nodeId, text, startEdit);

      if (!newNodeId) {
        return failure(`Failed to create new ${config.nodeType} node`);
      }

      const action = config.nodeType === 'child' ? 'to' : 'after';
      return success(`Added ${config.nodeType} node ${action} "${node.text}"`);
    },
    `Failed to add ${config.nodeType} node`
  )
});

export const addChildCommand = createAddNodeCommand({
  name: 'add-child',
  aliases: ['child', 'tab'],
  description: 'Add a new child node to the selected node',
  nodeType: 'child'
});

export const addSiblingCommand = createAddNodeCommand({
  name: 'add-sibling',
  aliases: ['sibling', 'enter'],
  description: 'Add a new sibling node after the selected node',
  nodeType: 'sibling'
});

// === Convert Node Command ===

const determineTargetType = (specifiedType: string | undefined, currentType?: string): MarkdownNodeType => {
  if (typeof specifiedType === 'string') {
    const t = specifiedType;
    if (t === 'heading' || t === 'unordered-list' || t === 'ordered-list') {
      return t;
    }
    return 'unordered-list';
  }

  if (currentType === 'heading') return 'unordered-list';
  if (currentType === 'ordered-list') return 'unordered-list';
  if (currentType === 'unordered-list') return 'heading';
  return 'unordered-list';
};

export const convertNodeCommand: Command = {
  name: 'convert',
  aliases: ['m', 'convert-type'],
  description: 'Convert node type (e.g., heading to list)',
  category: 'structure',
  examples: ['convert', 'm', 'convert --type unordered-list', 'convert node-123 --type heading'],
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

  execute: withErrorHandling((context: CommandContext, args: ArgsMap = {}) => {
    const nodeId = getNodeId(args, context);

    if (!nodeId) {
      const errorMessage = 'ノードが選択されておらず、ノードIDも指定されていません';
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    if (!context.handlers.onMarkdownNodeType) {
      const errorMessage = 'ノード型変換機能が利用できません';
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    const specifiedType = getArg<string>(args, 'type');
    const targetType = determineTargetType(specifiedType, node.markdownMeta?.type);

    context.handlers.onMarkdownNodeType(nodeId, targetType);
    return success(`Converted "${node.text}" to ${targetType}`);
  }, 'ノード変換に失敗しました')
};

// === Move Node Commands ===

export const moveAsChildOfSiblingCommand: Command = {
  name: 'move-as-child-of-sibling',
  aliases: ['>>'],
  description: 'Move the selected node as a child of its previous sibling',
  category: 'structure',
  examples: ['move-as-child-of-sibling', '>>'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to move (uses selected node if not specified)'
    }
  ],

  execute: withErrorHandling(
    async (context: CommandContext, args: Record<string, unknown> = {}): Promise<CommandResult> => {
      const nodeId = getNodeId(args, context);

      if (!nodeId) {
        return failure('No node selected and no node ID provided');
      }

      const node = context.handlers.findNodeById(nodeId);
      if (!node) {
        return failure(`Node ${nodeId} not found`);
      }

      if (!context.handlers.findParentNode) {
        return failure('Parent node lookup is not available');
      }

      const parentNode = context.handlers.findParentNode(nodeId);
      if (!parentNode) {
        return failure('Cannot move root node as child of sibling');
      }

      const siblings = parentNode.children || [];
      const currentIndex = siblings.findIndex(sibling => sibling.id === nodeId);

      if (currentIndex <= 0) {
        return failure('No previous sibling to move under');
      }

      const previousSibling = siblings[currentIndex - 1];

      if (!context.handlers.moveNode) {
        return failure('Move node functionality is not available');
      }

      await context.handlers.moveNode(nodeId, previousSibling.id);

      return success(`Moved "${node.text}" as child of "${previousSibling.text}"`);
    },
    'Failed to move node'
  )
};

export const moveAsNextSiblingOfParentCommand: Command = {
  name: 'move-as-next-sibling-of-parent',
  aliases: ['<<'],
  description: 'Move the selected node as the next sibling of its parent',
  category: 'structure',
  examples: ['move-as-next-sibling-of-parent', '<<'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to move (uses selected node if not specified)'
    }
  ],

  execute: withErrorHandling(
    async (context: CommandContext, args: Record<string, unknown> = {}): Promise<CommandResult> => {
      const nodeId = getNodeId(args, context);

      if (!nodeId) {
        return failure('No node selected and no node ID provided');
      }

      const node = context.handlers.findNodeById(nodeId);
      if (!node) {
        return failure(`Node ${nodeId} not found`);
      }

      if (!context.handlers.findParentNode) {
        return failure('Parent node lookup is not available');
      }

      const parentNode = context.handlers.findParentNode(nodeId);
      if (!parentNode) {
        return failure('Cannot move root node - no parent exists');
      }

      if (!context.handlers.moveNodeWithPosition) {
        return failure('Move node with position functionality is not available');
      }

      await context.handlers.moveNodeWithPosition(nodeId, parentNode.id, 'after');

      return success(`Moved "${node.text}" as next sibling of "${parentNode.text}"`);
    },
    'Failed to move node'
  )
};
