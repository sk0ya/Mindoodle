import { describe, expect, it, vi } from 'vitest';
import type { CommandContext } from '../system/types';
import type { MindMapNode } from '@shared/types';
import {
  allGuards,
  alwaysGuard,
  canRedo,
  canUndo,
  command,
  editingCommand,
  getSelectedNode,
  hasEditingNode,
  hasSelectedNode,
  hasVim,
  inMode,
  navigationCommand,
  notGuard,
  notInMode,
  utilityCommand,
  vimCommand,
  whenGuard,
  withCount,
} from './commandFunctional';
import {
  createFormatToggleCommand,
  createNodeCommand,
  getArg,
  getNodeId,
  requireCondition,
  requireNode,
  withErrorHandling,
} from './commandFactories';

const selectedNode: MindMapNode = {
  id: 'node-1',
  text: 'Selected',
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children: [],
};

const makeContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  selectedNodeId: 'node-1',
  editingNodeId: null,
  handlers: {
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    findNodeById: vi.fn((id: string) => id === selectedNode.id ? selectedNode : null),
    navigateToDirection: vi.fn(),
    selectNode: vi.fn(),
    startEdit: vi.fn(),
    startEditWithCursorAtStart: vi.fn(),
    startEditWithCursorAtEnd: vi.fn(),
    addChildNode: vi.fn(async () => null),
    addSiblingNode: vi.fn(async () => null),
    copyNode: vi.fn(),
    copyNodeText: vi.fn(async () => undefined),
    pasteNode: vi.fn(async () => undefined),
    pasteImageFromClipboard: vi.fn(async () => undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: false,
    showKeyboardHelper: false,
    setShowKeyboardHelper: vi.fn(),
    showMapList: false,
    setShowMapList: vi.fn(),
    showLocalStorage: false,
    setShowLocalStorage: vi.fn(),
    showTutorial: false,
    setShowTutorial: vi.fn(),
    closeAttachmentAndLinkLists: vi.fn(),
  },
  ...overrides,
});

describe('commandFunctional', () => {
  it('combines guards and exposes common context guards', () => {
    const context = makeContext({ editingNodeId: 'node-1', vim: { isEnabled: true } as CommandContext['vim'] });
    expect(alwaysGuard(context, {})).toBe(true);
    expect(hasSelectedNode(context, {})).toBe(true);
    expect(hasEditingNode(context, {})).toBe(true);
    expect(hasVim(context, {})).toBe(true);
    expect(canUndo(context, {})).toBe(true);
    expect(canRedo(context, {})).toBe(false);
    expect(inMode('normal')({ ...context, mode: 'normal' }, {})).toBe(true);
    expect(notInMode('insert')({ ...context, mode: 'normal' }, {})).toBe(true);
    expect(allGuards(hasSelectedNode, hasEditingNode)(context, {})).toBe(true);
    expect(notGuard(hasSelectedNode)({ ...context, selectedNodeId: null }, {})).toBe(true);
    expect(getSelectedNode(context)).toEqual(selectedNode);
    expect(getSelectedNode({ ...context, selectedNodeId: null })).toBeNull();
  });

  it('builds categorized commands, gates execution, and forwards counts', async () => {
    const execute = vi.fn(() => ({ success: true as const }));
    expect(command('base', 'Base', execute)).toMatchObject({ name: 'base', description: 'Base' });
    expect(navigationCommand('nav', 'Nav', execute).category).toBe('navigation');
    expect(editingCommand('edit', 'Edit', execute).category).toBe('editing');
    const vim = vimCommand('vim', 'Vim', execute);
    expect(vim.category).toBe('vim');
    expect(vim.guard?.(makeContext({ vim: undefined }), {})).toBe(false);
    expect(vim.guard?.(makeContext({ vim: { isEnabled: true } as CommandContext['vim'] }), {})).toBe(true);
    expect(utilityCommand('util', 'Util', execute).category).toBe('utility');

    const guarded = whenGuard(() => false, async () => ({ success: true }));
    await expect(guarded(makeContext(), {})).resolves.toEqual({ success: false, error: 'Guard condition not met' });
    const counted = withCount(1, async (_context, _args, count) => ({ success: true, data: count }));
    await expect(counted(makeContext({ count: 3 }), {})).resolves.toEqual({ success: true, data: 3 });
  });
});

describe('commandFactories', () => {
  it('extracts arguments and resolves required nodes', () => {
    const context = makeContext();
    expect(getArg({ value: 3 }, 'value', 1)).toBe(3);
    expect(getArg({}, 'value', 1)).toBe(1);
    expect(getNodeId({}, context)).toBe('node-1');
    expect(getNodeId({ nodeId: 'explicit' }, context)).toBe('explicit');
    expect(requireNode('node-1', context)).toMatchObject({ success: true, nodeId: 'node-1', node: selectedNode });
    expect(requireNode(null, context)).toEqual({ success: false, error: 'No node selected and no node ID provided' });
    expect(requireNode('missing', context)).toEqual({ success: false, error: 'Node missing not found' });
    expect(requireCondition(true, 'bad')).toEqual({ success: true });
    expect(requireCondition(false, 'bad')).toEqual({ success: false, error: 'bad' });
  });

  it('converts thrown command errors to failures', async () => {
    const wrapped = withErrorHandling(async () => { throw new Error('boom'); }, 'fallback');
    await expect(wrapped()).resolves.toEqual({ success: false, error: 'boom' });
    const wrappedUnknown = withErrorHandling(async () => { throw 'boom'; }, 'fallback');
    await expect(wrappedUnknown()).resolves.toEqual({ success: false, error: 'fallback' });
  });

  it('creates node commands with selected-node fallback and success messages', async () => {
    const context = makeContext();
    const execute = vi.fn(async () => undefined);
    const command = createNodeCommand({
      name: 'mark',
      description: 'Mark node',
      execute,
      successMsg: node => `Marked ${node.text}`,
    });
    await expect(command.execute(context, {})).resolves.toEqual({ success: true, message: 'Marked Selected' });
    expect(execute).toHaveBeenCalledWith('node-1', selectedNode, context);
    await expect(command.execute({ ...context, selectedNodeId: null }, {})).resolves.toEqual({
      success: false,
      error: 'No node selected and no node ID provided',
    });
  });

  it('creates format toggle commands that update the selected node', async () => {
    const context = makeContext();
    const formatCommand = createFormatToggleCommand({
      name: 'bold',
      aliases: ['b'],
      description: 'Toggle bold',
      formatType: 'bold',
    });
    await expect(formatCommand.execute(context, {})).resolves.toMatchObject({ success: true });
    expect(context.handlers.updateNode).toHaveBeenCalledWith('node-1', { text: '**Selected**' });
  });
});
