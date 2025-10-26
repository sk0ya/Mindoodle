/**
 * Structure commands - refactored with functional patterns
 * Reduced from 273 lines to 157 lines (42% reduction)
 */

import type { Command, CommandContext, CommandResult, MarkdownNodeType, ArgsMap } from '../system/types';
import { statusMessages } from '@shared/utils';
import { structureCommand, failure, success, withCount } from '../utils/commandFunctional';

// === Add Node Commands ===

const createAddNodeCommand = (
  name: string,
  aliases: string[],
  description: string,
  nodeType: 'child' | 'sibling'
): Command =>
  structureCommand(
    name,
    description,
    async (context, args) => {
      const nodeId = (args[nodeType === 'child' ? 'parentId' : 'nodeId'] as string) ?? context.selectedNodeId;
      const text = (args['text'] as string) ?? '';
      const startEdit = (args['edit'] as boolean) ?? true;

      if (!nodeId) return failure('No node selected and no node ID provided');

      const node = context.handlers.findNodeById(nodeId);
      if (!node) return failure(`Node ${nodeId} not found`);

      const handler = nodeType === 'child' ? context.handlers.addChildNode : context.handlers.addSiblingNode;
      const newNodeId = await handler(nodeId, text, startEdit);

      if (!newNodeId) return failure(`Failed to create new ${nodeType} node`);

      const action = nodeType === 'child' ? 'to' : 'after';
      return success(`Added ${nodeType} node ${action} "${node.text}"`);
    },
    {
      aliases,
      examples: [name, ...aliases, `${name} --text "Text"`, `${name} --edit`],
      args: [
        {
          name: nodeType === 'child' ? 'parentId' : 'nodeId',
          type: 'node-id',
          required: false,
          description: nodeType === 'child'
            ? 'Parent node ID (uses selected node if not specified)'
            : 'Reference node ID (uses selected node if not specified)'
        },
        { name: 'text', type: 'string', required: false, default: '', description: `Initial text for the new ${nodeType} node` },
        { name: 'edit', type: 'boolean', required: false, default: true, description: 'Start editing the new node immediately' }
      ]
    }
  );

export const addChildCommand = createAddNodeCommand('add-child', ['child', 'tab'], 'Add a new child node to the selected node', 'child');
export const addSiblingCommand = createAddNodeCommand('add-sibling', ['sibling', 'enter'], 'Add a new sibling node after the selected node', 'sibling');

// === Convert Node Command ===

const determineTargetType = (specifiedType: string | undefined, currentType?: string): MarkdownNodeType => {
  if (specifiedType === 'heading' || specifiedType === 'unordered-list' || specifiedType === 'ordered-list') {
    return specifiedType;
  }
  if (currentType === 'heading') return 'unordered-list';
  if (currentType === 'ordered-list') return 'unordered-list';
  if (currentType === 'unordered-list') return 'heading';
  return 'unordered-list';
};

export const convertNodeCommand: Command = structureCommand(
  'convert',
  'Convert node type (e.g., heading to list)',
  (context, args) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    if (!nodeId) return failure('No node selected and no node ID provided');

    const node = context.handlers.findNodeById(nodeId);
    if (!node) return failure(`Node ${nodeId} not found`);
    if (!context.handlers.onMarkdownNodeType) return failure('Node type conversion not available');

    const targetType = determineTargetType(args['type'] as string, node.markdownMeta?.type);
    context.handlers.onMarkdownNodeType(nodeId, targetType);
    return success(`Converted "${node.text}" to ${targetType}`);
  },
  {
    aliases: ['m', 'convert-type'],
    examples: ['convert', 'm', 'convert --type unordered-list', 'convert node-123 --type heading'],
    args: [
      { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to convert (uses selected node if not specified)' },
      { name: 'type', type: 'string', required: false, description: 'Target type: heading, unordered-list, ordered-list' }
    ]
  }
);

// === Move Node Commands ===

const createMoveCommand = (
  name: string,
  aliases: string[],
  description: string,
  validateAndMove: (
    context: CommandContext,
    nodeId: string,
    node: MindMapNode,
    parentNode: MindMapNode | null
  ) => Promise<CommandResult>
): Command =>
  structureCommand(
    name,
    description,
    async (context, args) => {
      const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
      if (!nodeId) return failure('No node selected and no node ID provided');

      const node = context.handlers.findNodeById(nodeId);
      if (!node) return failure(`Node ${nodeId} not found`);
      if (!context.handlers.findParentNode) return failure('Parent node lookup is not available');

      const parentNode = context.handlers.findParentNode(nodeId);
      return await validateAndMove(context, nodeId, node, parentNode);
    },
    { aliases, examples: [name, ...aliases], args: [{ name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to move (uses selected node if not specified)' }] }
  );

export const moveAsChildOfSiblingCommand = createMoveCommand(
  'move-as-child-of-sibling',
  ['>>'],
  'Move the selected node as a child of its previous sibling',
  async (context, nodeId, node, parentNode) => {
    if (!parentNode) return failure('Cannot move root node as child of sibling');

    const siblings = parentNode.children || [];
    const currentIndex = siblings.findIndex(s => s.id === nodeId);
    if (currentIndex <= 0) return failure('No previous sibling to move under');

    const previousSibling = siblings[currentIndex - 1];
    if (!context.handlers.moveNode) return failure('Move node functionality is not available');

    await context.handlers.moveNode(nodeId, previousSibling.id);
    return success(`Moved "${node.text}" as child of "${previousSibling.text}"`);
  }
);

export const moveAsNextSiblingOfParentCommand = createMoveCommand(
  'move-as-next-sibling-of-parent',
  ['<<'],
  'Move the selected node as the next sibling of its parent',
  async (context, nodeId, node, parentNode) => {
    if (!parentNode) return failure('Cannot move root node - no parent exists');
    if (!context.handlers.moveNodeWithPosition) return failure('Move node with position functionality is not available');

    await context.handlers.moveNodeWithPosition(nodeId, parentNode.id, 'after');
    return success(`Moved "${node.text}" as next sibling of "${parentNode.text}"`);
  }
);
