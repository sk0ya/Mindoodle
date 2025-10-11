

import type { Command, CommandContext, CommandResult, ArgsMap } from '../system/types';
export { showKnowledgeGraphCommand } from './showKnowledgeGraph';


export const helpCommand: Command = {
  name: 'help',
  aliases: ['?', 'keyboard-help'],
  description: 'Toggle keyboard shortcuts help panel',
  category: 'utility',
  examples: ['help', '?', 'keyboard-help'],

  execute(context: CommandContext): CommandResult {
    try {
      const currentState = context.handlers.showKeyboardHelper;
      context.handlers.setShowKeyboardHelper(!currentState);

      return {
        success: true,
        message: `${currentState ? 'Closed' : 'Opened'} keyboard shortcuts help`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle help panel'
      };
    }
  }
};


export const closePanelsCommand: Command = {
  name: 'close-panels',
  aliases: ['close', 'escape'],
  description: 'Close all open panels and overlays',
  category: 'utility',
  examples: ['close-panels', 'close', 'escape'],

  execute(context: CommandContext): CommandResult {
    try {
      
      if (context.handlers.showMapList) context.handlers.setShowMapList(false);
      if (context.handlers.showLocalStorage) context.handlers.setShowLocalStorage(false);
      if (context.handlers.showTutorial) context.handlers.setShowTutorial(false);
      if (context.handlers.showKeyboardHelper) context.handlers.setShowKeyboardHelper(false);

      
      context.handlers.closeAttachmentAndLinkLists();

      return {
        success: true,
        message: 'Closed all panels'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close panels'
      };
    }
  }
};


export const toggleMarkdownPanelCommand: Command = {
  name: 'toggle-markdown-panel',
  aliases: ['toggle-md', 'md-panel'],
  description: 'Toggle Markdown panel visibility',
  category: 'ui',
  examples: ['toggle-markdown-panel', 'toggle-md'],

  execute(context: CommandContext): CommandResult {
    try {
      const canToggle = typeof context.handlers.toggleNotesPanel === 'function';
      const canSet = typeof context.handlers.setShowNotesPanel === 'function';
      const hasState = typeof context.handlers.showNotesPanel === 'boolean';

      if (canToggle) {
        (context.handlers.toggleNotesPanel as () => void)();
      } else if (canSet && hasState) {
        (context.handlers.setShowNotesPanel as (b: boolean) => void)(!(context.handlers.showNotesPanel as boolean));
      } else {
        return { success: false, error: 'Markdown panel controls are not available' };
      }

      return { success: true, message: 'Toggled Markdown panel' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle Markdown panel'
      };
    }
  }
};


export const toggleNodeNotePanelCommand: Command = {
  name: 'toggle-node-note-panel',
  aliases: ['toggle-node-note', 'node-note-panel'],
  description: 'Toggle Selected Node Note panel visibility',
  category: 'ui',
  examples: ['toggle-node-note-panel', 'toggle-node-note'],

  execute(context: CommandContext): CommandResult {
    try {
      const canToggle = typeof context.handlers.toggleNodeNotePanel === 'function';
      const canSet = typeof context.handlers.setShowNodeNotePanel === 'function';
      const hasState = typeof context.handlers.showNodeNotePanel === 'boolean';

      if (canToggle) {
        (context.handlers.toggleNodeNotePanel as () => void)();
      } else if (canSet && hasState) {
        (context.handlers.setShowNodeNotePanel as (b: boolean) => void)(!(context.handlers.showNodeNotePanel as boolean));
      } else {
        return { success: false, error: 'Node note panel controls are not available' };
      }

      return { success: true, message: 'Toggled Node Note panel' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle Node Note panel'
      };
    }
  }
};


export const toggleVimSettingsPanelCommand: Command = {
  name: 'toggle-vim-settings',
  aliases: ['vim-settings', 'vim-panel'],
  description: 'Toggle Vim settings panel visibility',
  category: 'ui',
  examples: ['toggle-vim-settings', 'vim-settings'],

  execute(context: CommandContext): CommandResult {
    try {
      const handlers = context.handlers as Record<string, unknown>;
      const canToggle = typeof handlers.toggleVimSettingsPanel === 'function';
      const canSet = typeof handlers.setShowVimSettingsPanel === 'function';
      const hasState = typeof handlers.showVimSettingsPanel === 'boolean';

      if (canToggle) {
        (handlers.toggleVimSettingsPanel as () => void)();
      } else if (canSet && hasState) {
        (handlers.setShowVimSettingsPanel as (b: boolean) => void)(!handlers.showVimSettingsPanel);
      } else {
        return { success: false, error: 'Vim settings panel controls are not available' };
      }

      return { success: true, message: 'Toggled Vim settings panel' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle Vim settings panel'
      };
    }
  }
};


export const startEditCommand: Command = {
  name: 'start-edit',
  aliases: ['edit-start'],
  description: 'Start editing the selected node',
  category: 'editing',
  examples: ['start-edit', 'edit-start', 'start-edit node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: ArgsMap): CommandResult {
    const nodeId = typeof args['nodeId'] === 'string' ? args['nodeId'] : context.selectedNodeId;

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
      context.handlers.startEdit(nodeId);
      return {
        success: true,
        message: `Started editing "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing'
      };
    }
  }
};


export const startEditEndCommand: Command = {
  name: 'start-edit-end',
  aliases: ['edit-end'],
  description: 'Start editing with cursor at the end of node text',
  category: 'editing',
  examples: ['start-edit-end', 'edit-end'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to edit (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: ArgsMap): CommandResult {
    const nodeId = typeof args['nodeId'] === 'string' ? args['nodeId'] : context.selectedNodeId;

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
      context.handlers.startEditWithCursorAtEnd(nodeId);
      return {
        success: true,
        message: `Started editing "${node.text}" with cursor at end`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start editing'
      };
    }
  }
};


export const markdownConvertCommand: Command = {
  name: 'markdown-convert',
  aliases: ['convert-markdown', 'md-convert'],
  description: 'Convert markdown heading to list',
  category: 'editing',
  examples: ['markdown-convert', 'md-convert', 'convert-markdown node-123'],
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
      default: 'unordered-list',
      description: 'Target type: heading, unordered-list, ordered-list'
    }
  ],

  execute(context: CommandContext, args: ArgsMap): CommandResult {
    const nodeId = typeof args['nodeId'] === 'string' ? args['nodeId'] : context.selectedNodeId;
    const targetType = typeof args['type'] === 'string' ? args['type'] : 'unordered-list';

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    if (!context.handlers.onMarkdownNodeType) {
      return {
        success: false,
        error: 'Markdown conversion is not available'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    
    if (node.markdownMeta?.type !== 'heading') {
      return {
        success: false,
        error: 'Node is not a markdown heading'
      };
    }

    try {
      context.handlers.onMarkdownNodeType(nodeId, targetType as 'heading' | 'unordered-list' | 'ordered-list');
      return {
        success: true,
        message: `Converted "${node.text}" from heading to ${targetType}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert markdown node'
      };
    }
  }
};
