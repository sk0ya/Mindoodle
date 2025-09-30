/**
 * Insert Commands
 * Vim-style insert mode commands (i, a, o)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

// Insert mode at cursor start (vim 'i')
export const insertCommand: Command = {
  name: 'insert',
  aliases: ['i', 'insert-start'],
  description: 'Start editing at the beginning of node text (vim i)',
  category: 'editing',
  examples: [
    'insert',
    'i',
    'insert node-123'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at start
      context.handlers.startEditWithCursorAtStart(nodeId);

      return {
        success: true,
        message: `Started editing "${node.text}" at cursor start`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start insert mode'
      };
    }
  }
};

// Append mode at cursor end (vim 'a')
export const appendCommand: Command = {
  name: 'append',
  aliases: ['a', 'insert-end'],
  description: 'Start editing at the end of node text (vim a)',
  category: 'editing',
  examples: [
    'append',
    'a',
    'append node-123'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Start editing with cursor at end
      context.handlers.startEditWithCursorAtEnd(nodeId);

      return {
        success: true,
        message: `Started editing "${node.text}" at cursor end`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start append mode'
      };
    }
  }
};

// Open new line and insert (vim 'o') - Create younger sibling
export const openCommand: Command = {
  name: 'open',
  aliases: ['o', 'add-younger-sibling'],
  description: 'Create new younger sibling node and start editing (vim o)',
  category: 'editing',
  examples: [
    'open',
    'o',
    'open node-123',
    'add-younger-sibling --text "Initial text"'
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
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const initialText = (args as any)['text'] || '';

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create new sibling node after the current node and start editing
      const newNodeId = await context.handlers.addSiblingNode(nodeId, initialText, true);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new sibling node'
        };
      }

      return {
        success: true,
        message: `Created new sibling node after "${referenceNode.text}" and started editing`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open new sibling node'
      };
    }
  }
};

// Open new line above and insert (vim 'O') - Create elder sibling
export const openAboveCommand: Command = {
  name: 'open-above',
  aliases: ['O', 'add-elder-sibling'],
  description: 'Create new elder sibling node and start editing (vim O)',
  category: 'editing',
  examples: [
    'open-above',
    'O',
    'open-above node-123',
    'add-elder-sibling --text "Initial text"'
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
    }
  ],

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const initialText = (args as any)['text'] || '';

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
      // Set vim mode to insert if vim is enabled
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      // Create a new elder sibling node before the current node (insertAfter: false)
      const newNodeId = await context.handlers.addSiblingNode(nodeId, initialText, true, false);

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new elder sibling node'
        };
      }

      return {
        success: true,
        message: `Created new elder sibling node before "${referenceNode.text}" and started editing`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open new sibling node above'
      };
    }
  }
};
/**
 * Insert Checkbox Child Command (vim 'X')
 * Adds a new checkbox list child node, positioning it before any heading nodes to maintain map structure
 */
export const insertCheckboxChildCommand: Command = {
  name: 'insert-checkbox-child',
  aliases: ['X', 'add-checkbox-child'],
  description: 'Add a new checkbox list child node, positioning before heading nodes',
  category: 'editing',
  examples: [
    'insert-checkbox-child',
    'X'
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
      // 最初に見出しノードの位置を特定
      const currentSiblings = parentNode.children || [];
      let targetInsertIndex = -1; // 見出しノードの位置
      
      for (let i = 0; i < currentSiblings.length; i++) {
        const sibling = currentSiblings[i];
        if (sibling.markdownMeta?.type === 'heading') {
          targetInsertIndex = i;
          break;
        }
      }

      // 通常のadd-childでノードを追加（最後に追加される）
      const newNodeId = await context.handlers.addChildNode(parentId, text, false); // 編集は後で

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new child node'
        };
      }

      // チェックボックスのメタデータを設定
      let level = 1;
      let indentLevel = 0;
      
      if (parentNode.markdownMeta) {
        if (parentNode.markdownMeta.type === 'heading') {
          level = 1;
          indentLevel = 0;
        } else if (parentNode.markdownMeta.type === 'unordered-list' || parentNode.markdownMeta.type === 'ordered-list') {
          level = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
          indentLevel = Math.max(level - 1, 0) * 2;
        }
      }

      const checkboxMarkdownMeta = {
        type: 'unordered-list' as const,
        level,
        originalFormat: '- [ ]',
        indentLevel,
        lineNumber: 0,
        isCheckbox: true,
        isChecked: false
      };

      // チェックボックスメタデータを設定
      context.handlers.updateNode(newNodeId, { 
        markdownMeta: checkboxMarkdownMeta 
      });

      // 見出しノードより上に移動させる
      if (targetInsertIndex >= 0 && context.handlers.changeSiblingOrder) {
        // 更新された親ノードを再取得
        const updatedParentNode = context.handlers.findNodeById(parentId);
        if (updatedParentNode && updatedParentNode.children) {
          const targetSibling = updatedParentNode.children[targetInsertIndex];
          if (targetSibling) {
            // 新しいノードを見出しノードの前に移動
            context.handlers.changeSiblingOrder(newNodeId, targetSibling.id, true); // insert before
          }
        }
      }

      // Vimモードと編集開始
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      if (startEdit) {
        context.handlers.startEdit(newNodeId);
      }

      return {
        success: true,
        message: `Added checkbox child node to "${parentNode.text}"${targetInsertIndex >= 0 ? ' (positioned before heading)' : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to insert checkbox child node'
      };
    }
  }
};;
