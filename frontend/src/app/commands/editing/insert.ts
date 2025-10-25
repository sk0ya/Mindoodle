/**
 * Insert/Append commands - refactored with functional patterns
 * Reduced from 414 lines to ~180 lines through reusable factories
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import {
  createEditCommand,
  createSiblingCommand,
  getArg,
  getNodeId,
  requireNode,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

// === Simple Edit Commands ===

export const insertCommand = createEditCommand({
  name: 'insert',
  aliases: ['i', 'insert-start'],
  description: 'Start editing at the beginning of node text (vim i)',
  cursorPosition: 'start',
  examples: ['insert', 'i', 'insert node-123']
});

export const appendCommand = createEditCommand({
  name: 'append',
  aliases: ['a', 'insert-end'],
  description: 'Start editing at the end of node text (vim a)',
  cursorPosition: 'end',
  examples: ['append', 'a', 'append node-123']
});

// === Sibling Creation Commands ===

export const openCommand = createSiblingCommand({
  name: 'open',
  aliases: ['o', 'add-younger-sibling'],
  description: 'Create new younger sibling node and start editing (vim o)',
  insertAfter: true,
  examples: ['open', 'o', 'open node-123', 'add-younger-sibling --text "Initial text"']
});

export const openAboveCommand = createSiblingCommand({
  name: 'open-above',
  aliases: ['O', 'add-elder-sibling'],
  description: 'Create new elder sibling node and start editing (vim O)',
  insertAfter: false,
  examples: ['open-above', 'O', 'open-above node-123', 'add-elder-sibling --text "Initial text"']
});

// === Checkbox Command (complex logic preserved) ===

export const insertCheckboxChildCommand: Command = {
  name: 'insert-checkbox-child',
  aliases: ['X', 'add-checkbox-child'],
  description: 'Add a new checkbox list child node, positioning before heading nodes',
  category: 'editing',
  examples: ['insert-checkbox-child', 'X'],
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
      description: 'Initial text for the new checkbox node'
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
    async (context: CommandContext, args: Record<string, unknown> = {}): Promise<CommandResult> => {
      const parentId = getArg<string>(args, 'parentId') ?? context.selectedNodeId;
      const text = getArg<string>(args, 'text') ?? '';
      const startEdit = getArg<boolean>(args, 'edit') ?? true;

      if (!parentId) {
        return failure('No node selected and no parent ID provided');
      }

      const parentNode = context.handlers.findNodeById(parentId);
      if (!parentNode) {
        return failure(`Parent node ${parentId} not found`);
      }

      // Find first heading sibling to insert before
      const currentSiblings = parentNode.children || [];
      const targetInsertIndex = currentSiblings.findIndex(
        (sibling) => sibling.markdownMeta?.type === 'heading'
      );

      // Create new child node
      const newNodeId = await context.handlers.addChildNode(parentId, text, false);
      if (!newNodeId) {
        return failure('Failed to create new child node');
      }

      // Calculate indentation based on parent
      const level = parentNode.markdownMeta &&
        (parentNode.markdownMeta.type === 'unordered-list' ||
          parentNode.markdownMeta.type === 'ordered-list')
        ? Math.max((parentNode.markdownMeta.level || 1) + 1, 1)
        : 1;

      const indentLevel = Math.max(level - 1, 0) * 2;

      // Update node with checkbox metadata
      context.handlers.updateNode(newNodeId, {
        markdownMeta: {
          type: 'unordered-list' as const,
          level,
          originalFormat: '- [ ]',
          indentLevel,
          lineNumber: 0,
          isCheckbox: true,
          isChecked: false
        }
      });

      // Reorder if needed
      if (targetInsertIndex >= 0 && context.handlers.changeSiblingOrder) {
        const updatedParentNode = context.handlers.findNodeById(parentId);
        const targetSibling = updatedParentNode?.children?.[targetInsertIndex];

        if (targetSibling) {
          context.handlers.changeSiblingOrder(newNodeId, targetSibling.id, true);
        }
      }

      // Start editing
      if (context.vim?.isEnabled) {
        context.vim.setMode('insert');
      }

      if (startEdit) {
        context.handlers.startEdit(newNodeId);
      }

      const positionMsg =
        targetInsertIndex >= 0 ? ' (positioned before heading)' : '';

      return success(
        `Added checkbox child node to "${parentNode.text}"${positionMsg}`
      );
    },
    'Failed to insert checkbox child node'
  )
};
