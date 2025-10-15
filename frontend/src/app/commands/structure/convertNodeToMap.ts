import type { Command, CommandContext, CommandResult, ArgsMap } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { statusMessages, logger } from '@shared/utils';
import { nodeToMarkdown } from '@markdown/markdownExport';

/**
 * Prepare node data for converting to a separate map
 * Returns the node data as markdown and removes children from original node
 * File creation and map switching should be handled by the caller
 */
export const convertNodeToMapCommand: Command = {
  name: 'convert-node-to-map',
  aliases: ['split-map', 'extract-map'],
  description: 'ノードとその子要素を別のマップに変換',
  category: 'structure',
  examples: [
    'convert-node-to-map',
    'split-map',
    'extract-map'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to convert (uses selected node if not specified)'
    }
  ],

  guard(context: CommandContext): boolean {
    const nodeId = context.selectedNodeId;
    if (!nodeId) {
      return false;
    }

    // Cannot convert root node
    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return false;
    }

    // Check if this is a root-level node (has no parent except 'root')
    const parent = context.handlers.findParentNode?.(nodeId);
    if (!parent || parent.id === 'root') {
      // Root-level nodes cannot be converted
      return false;
    }

    return true;
  },

  async execute(context: CommandContext, args: ArgsMap): Promise<CommandResult> {
    const nodeId = (typeof args['nodeId'] === 'string' ? args['nodeId'] : undefined) || context.selectedNodeId;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されていません';
      statusMessages.customError(errorMessage);
      return { success: false, error: errorMessage };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return { success: false, error: errorMessage };
    }

    // Check if this is a root-level node
    const parent = context.handlers.findParentNode?.(nodeId);
    if (!parent || parent.id === 'root') {
      const errorMessage = 'ルートレベルのノードはマップに変換できません';
      statusMessages.customError(errorMessage);
      return { success: false, error: errorMessage };
    }

    try {
      // Create new map data structure with the node as root
      const newRootNode: MindMapNode = {
        ...node,
        x: 0,
        y: 0,
        children: node.children || [] // Preserve all children
      };

      // Serialize the node and its children to markdown
      const markdown = nodeToMarkdown(newRootNode, 0);

      // Note: Children removal will be handled by the caller after this returns
      // This is because state updates are asynchronous and the caller needs
      // to ensure the removal is reflected before saving

      // Return the markdown and node info for the caller to handle file creation
      return {
        success: true,
        message: 'Node prepared for conversion',
        data: {
          markdown,
          nodeText: node.text,
          nodeId
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ノードの処理に失敗しました';
      logger.error('convertNodeToMap error:', error);
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};
