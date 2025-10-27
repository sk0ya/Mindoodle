/**
 * Convert node to map command - refactored with functional patterns
 * Reduced from 112 lines to 80 lines (29% reduction)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { logger } from '@shared/utils';
import { nodeToMarkdown } from '@markdown/markdownExport';
import { structureCommand, failure, success } from '../utils/commandFunctional';

// === Helpers ===

const isRootLevelNode = (context: CommandContext, nodeId: string): boolean => {
  const parent = context.handlers.findParentNode?.(nodeId);
  return !parent || parent.id === 'root';
};

const validateNodeForConversion = (context: CommandContext, nodeId: string | null) => {
  if (!nodeId) return failure('No node selected');

  const node = context.handlers.findNodeById(nodeId);
  if (!node) return failure(`Node ${nodeId} not found`);

  if (isRootLevelNode(context, nodeId)) {
    return failure('Root-level nodes cannot be converted to separate maps');
  }

  return { success: true, node };
};

const createNewRootNode = (node: MindMapNode): MindMapNode => ({
  ...node,
  x: 0,
  y: 0,
  children: node.children || []
});

// === Command ===

export const convertNodeToMapCommand: Command = structureCommand(
  'convert-node-to-map',
  'Convert node and its children to a separate map',
  async (context, args) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    const validation = validateNodeForConversion(context, nodeId);
    if (!validation.success) return validation;

    const { node } = validation;

    try {
      const newRootNode = createNewRootNode(node);
      const markdown = nodeToMarkdown(newRootNode, 0);

      return success('Node prepared for conversion', {
        markdown,
        nodeText: node.text,
        nodeId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process node';
      logger.error('convertNodeToMap error:', error);
      return failure(errorMessage);
    }
  },
  {
    aliases: ['split-map', 'extract-map'],
    examples: ['convert-node-to-map', 'split-map', 'extract-map'],
    args: [{ name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to convert (uses selected node if not specified)' }],
    guard: (context) => {
      const nodeId = context.selectedNodeId;
      if (!nodeId) return false;

      const node = context.handlers.findNodeById(nodeId);
      if (!node) return false;

      return !isRootLevelNode(context, nodeId);
    }
  }
);
