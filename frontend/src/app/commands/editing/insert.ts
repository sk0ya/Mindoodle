/**
 * Insert/Append commands - refactored with functional patterns
 * Reduced from 162 lines to 143 lines (12% reduction)
 */

import type { Command, CommandContext } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { editingCommand, failure, success } from '../utils/commandFunctional';

// === Helpers ===

const setVimInsertMode = (context: CommandContext) => {
  if (context.vim?.isEnabled) context.vim.setMode('insert');
};

const createEditCommand = (name: string, aliases: string[], description: string, position: 'start' | 'end'): Command =>
  editingCommand(
    name,
    description,
    (context) => {
      const nodeId = context.selectedNodeId;
      if (!nodeId) return failure('No node selected');

      setVimInsertMode(context);
      setTimeout(() => {
        if (position === 'end') context.handlers.startEditWithCursorAtEnd(nodeId);
        else context.handlers.startEditWithCursorAtStart(nodeId);
      }, 10);

      return success('Started editing');
    },
    { aliases, examples: [name, ...aliases] }
  );

const createSiblingCommand = (name: string, aliases: string[], description: string, insertAfter: boolean): Command =>
  editingCommand(
    name,
    description,
    async (context, args) => {
      const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
      const text = (args['text'] as string) ?? '';
      const startEdit = (args['edit'] as boolean) ?? true;

      if (!nodeId) return failure('No node selected');

      const node = context.handlers.findNodeById(nodeId);
      if (!node) return failure(`Node ${nodeId} not found`);

      const newNodeId = await context.handlers.addSiblingNode(nodeId, text, startEdit, insertAfter);

      if (!newNodeId) return failure('Failed to create sibling node');

      setVimInsertMode(context);
      return success(`Created ${insertAfter ? 'younger' : 'elder'} sibling node`);
    },
    {
      aliases,
      examples: [name, ...aliases],
      args: [
        { name: 'nodeId', type: 'node-id', required: false, description: 'Reference node ID (uses selected node if not specified)' },
        { name: 'text', type: 'string', required: false, default: '', description: 'Initial text for the new node' },
        { name: 'edit', type: 'boolean', required: false, default: true, description: 'Start editing immediately' }
      ]
    }
  );

// === Simple Edit Commands ===

export const insertCommand = createEditCommand('insert', ['i', 'insert-start'], 'Start editing at the beginning of node text (vim i)', 'start');
export const appendCommand = createEditCommand('append', ['a', 'insert-end'], 'Start editing at the end of node text (vim a)', 'end');

// === Sibling Creation Commands ===

export const openCommand = createSiblingCommand('open', ['o', 'add-younger-sibling'], 'Create new younger sibling node and start editing (vim o)', true);
export const openAboveCommand = createSiblingCommand('open-above', ['O', 'add-elder-sibling'], 'Create new elder sibling node and start editing (vim O)', false);

// === Checkbox Command ===

const calculateCheckboxLevel = (parentNode: MindMapNode): { level: number; indentLevel: number } => {
  const isListType = parentNode.markdownMeta?.type === 'unordered-list' || parentNode.markdownMeta?.type === 'ordered-list';
  const level = isListType ? Math.max((parentNode.markdownMeta?.level || 1) + 1, 1) : 1;
  return { level, indentLevel: Math.max(level - 1, 0) * 2 };
};

const findHeadingInsertIndex = (siblings: MindMapNode[]): number =>
  siblings.findIndex((s) => s.markdownMeta?.type === 'heading');

export const insertCheckboxChildCommand: Command = editingCommand(
  'insert-checkbox-child',
  'Add a new checkbox list child node, positioning before heading nodes',
  async (context, args) => {
    const parentId = (args['parentId'] as string) ?? context.selectedNodeId;
    const text = (args['text'] as string) ?? '';
    const startEdit = (args['edit'] as boolean) ?? true;

    if (!parentId) return failure('No node selected and no parent ID provided');

    const parentNode = context.handlers.findNodeById(parentId);
    if (!parentNode) return failure(`Parent node ${parentId} not found`);

    const targetInsertIndex = findHeadingInsertIndex(parentNode.children || []);
    const newNodeId = await context.handlers.addChildNode(parentId, text, false);
    if (!newNodeId) return failure('Failed to create new child node');

    const { level, indentLevel } = calculateCheckboxLevel(parentNode);

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
      const updatedParent = context.handlers.findNodeById(parentId);
      const targetSibling = updatedParent?.children?.[targetInsertIndex];
      if (targetSibling) context.handlers.changeSiblingOrder(newNodeId, targetSibling.id, true);
    }

    setVimInsertMode(context);
    if (startEdit) context.handlers.startEdit(newNodeId);

    const positionMsg = targetInsertIndex >= 0 ? ' (positioned before heading)' : '';
    return success(`Added checkbox child node to "${parentNode.text}"${positionMsg}`);
  },
  {
    aliases: ['X', 'add-checkbox-child'],
    examples: ['insert-checkbox-child', 'X'],
    args: [
      { name: 'parentId', type: 'node-id', required: false, description: 'Parent node ID (uses selected node if not specified)' },
      { name: 'text', type: 'string', required: false, default: '', description: 'Initial text for the new checkbox node' },
      { name: 'edit', type: 'boolean', required: false, default: true, description: 'Start editing the new node immediately' }
    ]
  }
);
