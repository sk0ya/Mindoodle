/**
 * UI commands - refactored with functional patterns
 * Reduced from 198 lines to 160 lines (19% reduction)
 */

import type { Command, CommandContext } from '../system/types';
import { uiCommand, editingCommand, failure, success } from '../utils/commandFunctional';

export { showKnowledgeGraphCommand } from './showKnowledgeGraph';

// === Toggle Commands ===

const createToggleCommand = (
  name: string,
  aliases: string[],
  description: string,
  getState: (ctx: CommandContext) => boolean | undefined,
  setState: (ctx: CommandContext, value: boolean) => void,
  panelName: string
): Command =>
  uiCommand(
    name,
    description,
    (context) => {
      const currentState = getState(context);
      setState(context, !currentState);
      return success(`${!currentState ? 'Opened' : 'Closed'} ${panelName}`);
    },
    { aliases, examples: [name, ...aliases] }
  );

export const helpCommand = createToggleCommand(
  'help',
  ['?', 'keyboard-help'],
  'Toggle keyboard shortcuts help panel',
  (ctx) => ctx.handlers.showKeyboardHelper,
  (ctx, value) => ctx.handlers.setShowKeyboardHelper(value),
  'keyboard shortcuts help'
);

export const closePanelsCommand: Command = uiCommand(
  'close-panels',
  'Close all open panels and overlays',
  (context) => {
    if (context.handlers.showMapList) context.handlers.setShowMapList(false);
    if (context.handlers.showLocalStorage) context.handlers.setShowLocalStorage(false);
    if (context.handlers.showTutorial) context.handlers.setShowTutorial(false);
    if (context.handlers.showKeyboardHelper) context.handlers.setShowKeyboardHelper(false);
    context.handlers.closeAttachmentAndLinkLists();
    return success('Closed all panels');
  },
  { aliases: ['close', 'escape'], examples: ['close-panels', 'close', 'escape'] }
);

// === Panel Toggle Commands ===

const createPanelToggleCommand = (
  name: string,
  aliases: string[],
  description: string,
  panelName: string,
  toggleFn: keyof CommandContext['handlers']
): Command =>
  uiCommand(
    name,
    description,
    (context) => {
      const fn = context.handlers[toggleFn] as (() => void) | undefined;
      if (!fn) return failure(`${panelName} toggle not available`);
      fn.call(context.handlers);
      return success(`Toggled ${panelName}`);
    },
    { aliases, examples: [name, ...aliases] }
  );

export const toggleMarkdownPanelCommand = createPanelToggleCommand(
  'toggle-markdown-panel',
  ['toggle-md', 'md-panel'],
  'Toggle Markdown panel visibility',
  'Markdown panel',
  'toggleNotesPanel'
);

export const toggleNodeNotePanelCommand = createPanelToggleCommand(
  'toggle-node-note-panel',
  ['toggle-node-note', 'node-note-panel'],
  'Toggle Selected Node Note panel visibility',
  'Node Note panel',
  'toggleNodeNotePanel'
);

export const toggleVimSettingsPanelCommand = createPanelToggleCommand(
  'toggle-vim-settings',
  ['vim-settings', 'vim-panel'],
  'Toggle Vim settings panel visibility',
  'Vim settings panel',
  'toggleVimSettingsPanel'
);

// === Edit Commands ===

const createStartEditCommand = (
  name: string,
  aliases: string[],
  description: string,
  cursorAtEnd: boolean
): Command =>
  editingCommand(
    name,
    description,
    (context, args) => {
      const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
      if (!nodeId) return failure('No node selected and no node ID provided');

      const node = context.handlers.findNodeById(nodeId);
      if (!node) return failure(`Node ${nodeId} not found`);

      if (cursorAtEnd) context.handlers.startEditWithCursorAtEnd(nodeId);
      else context.handlers.startEdit(nodeId);

      return success(`Started editing "${node.text}"${cursorAtEnd ? ' with cursor at end' : ''}`);
    },
    {
      aliases,
      examples: [name, ...aliases],
      args: [{ name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to edit (uses selected node if not specified)' }]
    }
  );

export const startEditCommand = createStartEditCommand('start-edit', ['edit-start'], 'Start editing the selected node', false);
export const startEditEndCommand = createStartEditCommand('start-edit-end', ['edit-end'], 'Start editing with cursor at the end of node text', true);

// === Markdown Conversion Command ===

export const markdownConvertCommand: Command = editingCommand(
  'markdown-convert',
  'Convert markdown heading to list',
  (context, args) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    const targetType = (args['type'] as string) ?? 'unordered-list';

    if (!nodeId) return failure('No node selected and no node ID provided');
    if (!context.handlers.onMarkdownNodeType) return failure('Markdown conversion is not available');

    const node = context.handlers.findNodeById(nodeId);
    if (!node) return failure(`Node ${nodeId} not found`);
    if (node.markdownMeta?.type !== 'heading') return failure('Node is not a markdown heading');

    context.handlers.onMarkdownNodeType(nodeId, targetType as 'heading' | 'unordered-list' | 'ordered-list');
    return success(`Converted "${node.text}" from heading to ${targetType}`);
  },
  {
    aliases: ['convert-markdown', 'md-convert'],
    examples: ['markdown-convert', 'md-convert', 'convert-markdown node-123'],
    args: [
      { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to convert (uses selected node if not specified)' },
      { name: 'type', type: 'string', required: false, default: 'unordered-list', description: 'Target type: heading, unordered-list, ordered-list' }
    ]
  }
);
