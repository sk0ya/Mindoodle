/**
 * UI commands - refactored with functional patterns
 * Reduced from 329 lines to ~110 lines (67% reduction)
 */

import type { Command, CommandContext, CommandResult, ArgsMap } from '../system/types';
import {
  createToggleCommand,
  createPanelToggleCommand,
  getArg,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

export { showKnowledgeGraphCommand } from './showKnowledgeGraph';

// === Toggle Commands ===

export const helpCommand = createToggleCommand({
  name: 'help',
  aliases: ['?', 'keyboard-help'],
  description: 'Toggle keyboard shortcuts help panel',
  getState: (ctx) => ctx.handlers.showKeyboardHelper,
  setState: (ctx, value) => ctx.handlers.setShowKeyboardHelper(value),
  panelName: 'keyboard shortcuts help'
});

export const closePanelsCommand: Command = {
  name: 'close-panels',
  aliases: ['close', 'escape'],
  description: 'Close all open panels and overlays',
  category: 'utility',
  examples: ['close-panels', 'close', 'escape'],

  execute: withErrorHandling((context: CommandContext) => {
    // Close all panels
    if (context.handlers.showMapList) context.handlers.setShowMapList(false);
    if (context.handlers.showLocalStorage) context.handlers.setShowLocalStorage(false);
    if (context.handlers.showTutorial) context.handlers.setShowTutorial(false);
    if (context.handlers.showKeyboardHelper) context.handlers.setShowKeyboardHelper(false);

    // Close attachment and link lists
    context.handlers.closeAttachmentAndLinkLists();

    return success('Closed all panels');
  }, 'Failed to close panels')
};

// === Panel Toggle Commands ===

export const toggleMarkdownPanelCommand = createPanelToggleCommand({
  name: 'toggle-markdown-panel',
  aliases: ['toggle-md', 'md-panel'],
  description: 'Toggle Markdown panel visibility',
  panelName: 'Markdown panel',
  toggleFn: 'toggleNotesPanel',
  setFn: 'setShowNotesPanel',
  stateProp: 'showNotesPanel'
});

export const toggleNodeNotePanelCommand = createPanelToggleCommand({
  name: 'toggle-node-note-panel',
  aliases: ['toggle-node-note', 'node-note-panel'],
  description: 'Toggle Selected Node Note panel visibility',
  panelName: 'Node Note panel',
  toggleFn: 'toggleNodeNotePanel',
  setFn: 'setShowNodeNotePanel',
  stateProp: 'showNodeNotePanel'
});

export const toggleVimSettingsPanelCommand = createPanelToggleCommand({
  name: 'toggle-vim-settings',
  aliases: ['vim-settings', 'vim-panel'],
  description: 'Toggle Vim settings panel visibility',
  panelName: 'Vim settings panel',
  toggleFn: 'toggleVimSettingsPanel',
  setFn: 'setShowVimSettingsPanel',
  stateProp: 'showVimSettingsPanel'
});

// === Edit Commands (kept for backwards compatibility) ===
// Note: These duplicate functionality in editing/edit.ts
// Consider removing and using those commands instead

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

  execute: withErrorHandling((context: CommandContext, args: ArgsMap = {}) => {
    const nodeId = getArg<string>(args, 'nodeId') ?? context.selectedNodeId;

    if (!nodeId) {
      return failure('No node selected and no node ID provided');
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return failure(`Node ${nodeId} not found`);
    }

    context.handlers.startEdit(nodeId);
    return success(`Started editing "${node.text}"`);
  }, 'Failed to start editing')
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

  execute: withErrorHandling((context: CommandContext, args: ArgsMap = {}) => {
    const nodeId = getArg<string>(args, 'nodeId') ?? context.selectedNodeId;

    if (!nodeId) {
      return failure('No node selected and no node ID provided');
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return failure(`Node ${nodeId} not found`);
    }

    context.handlers.startEditWithCursorAtEnd(nodeId);
    return success(`Started editing "${node.text}" with cursor at end`);
  }, 'Failed to start editing')
};

// === Markdown Conversion Command ===

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

  execute: withErrorHandling((context: CommandContext, args: ArgsMap = {}) => {
    const nodeId = getArg<string>(args, 'nodeId') ?? context.selectedNodeId;
    const targetType = getArg<string>(args, 'type') ?? 'unordered-list';

    if (!nodeId) {
      return failure('No node selected and no node ID provided');
    }

    if (!context.handlers.onMarkdownNodeType) {
      return failure('Markdown conversion is not available');
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return failure(`Node ${nodeId} not found`);
    }

    if (node.markdownMeta?.type !== 'heading') {
      return failure('Node is not a markdown heading');
    }

    context.handlers.onMarkdownNodeType(nodeId, targetType as 'heading' | 'unordered-list' | 'ordered-list');
    return success(`Converted "${node.text}" from heading to ${targetType}`);
  }, 'Failed to convert markdown node')
};
