
import type { Command, CommandContext, CommandResult } from '../system/types';


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

  execute(context: CommandContext, args: Record<string, unknown>): CommandResult {
    const nodeId = (args as Record<string, string | undefined>)['nodeId'] || context.selectedNodeId;

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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

  execute(context: CommandContext, args: Record<string, unknown>): CommandResult {
    const nodeId = (args as Record<string, string | undefined>)['nodeId'] || context.selectedNodeId;

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
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

  async execute(context: CommandContext, args: Record<string, unknown>): Promise<CommandResult> {
    const typedArgs = args as Record<string, string | undefined>;
    const nodeId = typedArgs['nodeId'] || context.selectedNodeId;
    const initialText = typedArgs['text'] || '';

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
      
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

  async execute(context: CommandContext, args: Record<string, unknown>): Promise<CommandResult> {
    const typedArgs = args as Record<string, string | undefined>;
    const nodeId = typedArgs['nodeId'] || context.selectedNodeId;
    const initialText = typedArgs['text'] || '';

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
      
      if (context.vim && context.vim.isEnabled) {
        context.vim.setMode('insert');
      }

      
      
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

  async execute(context: CommandContext, args: Record<string, unknown>): Promise<CommandResult> {
    const typedArgs = args as Record<string, string | boolean | undefined>;
    const parentId = (typedArgs['parentId'] as string | undefined) || context.selectedNodeId;
    const text = (typedArgs['text'] as string | undefined) || '';
    const startEdit = (typedArgs['edit'] as boolean | undefined) ?? true;

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
      
      const currentSiblings = parentNode.children || [];
      let targetInsertIndex = -1; 

      for (let i = 0; i < currentSiblings.length; i++) {
        const sibling = currentSiblings[i];
        if (sibling.markdownMeta?.type === 'heading') {
          targetInsertIndex = i;
          break;
        }
      }

      
      
      const newNodeId = await context.handlers.addChildNode(parentId, text, false); 

      if (!newNodeId) {
        return {
          success: false,
          error: 'Failed to create new child node'
        };
      }


      let level = 1;
      let indentLevel = 0;

      if (parentNode.markdownMeta && (parentNode.markdownMeta.type === 'unordered-list' || parentNode.markdownMeta.type === 'ordered-list')) {
        level = Math.max((parentNode.markdownMeta.level || 1) + 1, 1);
        indentLevel = Math.max(level - 1, 0) * 2;
      }
      // heading type uses default values (level=1, indentLevel=0)

      const checkboxMarkdownMeta = {
        type: 'unordered-list' as const,
        level,
        originalFormat: '- [ ]',
        indentLevel,
        lineNumber: 0,
        isCheckbox: true,
        isChecked: false
      };

      
      context.handlers.updateNode(newNodeId, {
        markdownMeta: checkboxMarkdownMeta
      });

      
      if (targetInsertIndex >= 0 && context.handlers.changeSiblingOrder) {
        
        const updatedParentNode = context.handlers.findNodeById(parentId);
        if (updatedParentNode && updatedParentNode.children) {
          const targetSibling = updatedParentNode.children[targetInsertIndex];
          if (targetSibling) {
            
            context.handlers.changeSiblingOrder(newNodeId, targetSibling.id, true); 
          }
        }
      }

      
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
