import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistryImpl, resetCommandRegistry } from '@commands/system/registry';
import type { Command, CommandContext } from '@commands/system/types';

/**
 * Integration tests for command execution flow
 * Tests the interaction between:
 * - Command registration
 * - Guard validation
 * - Command execution
 * - Error handling
 */

const createMockContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  selectedNodeId: null,
  editingNodeId: null,
  handlers: {
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    findNodeById: vi.fn(),
    navigateToDirection: vi.fn(),
    selectNode: vi.fn(),
    startEdit: vi.fn(),
    startEditWithCursorAtStart: vi.fn(),
    startEditWithCursorAtEnd: vi.fn(),
    addChildNode: vi.fn(),
    addSiblingNode: vi.fn(),
    copyNode: vi.fn(),
    copyNodeText: vi.fn(),
    pasteNode: vi.fn(),
    pasteImageFromClipboard: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
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

describe('Command Execution Flow Integration', () => {
  let registry: CommandRegistryImpl;

  beforeEach(() => {
    resetCommandRegistry();
    registry = new CommandRegistryImpl();
  });

  describe('Basic Command Flow', () => {
    it('should execute a simple command end-to-end', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const command: Command = {
        name: 'select-node',
        execute: executeFn,
        category: 'navigation',
        description: 'Select a node',
      };

      registry.register(command);
      const context = createMockContext({ selectedNodeId: 'node-1' });
      const result = await registry.execute('select-node', context);

      expect(result.success).toBe(true);
      expect(executeFn).toHaveBeenCalledWith(context, {});
    });

    it('should execute command with alias', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const command: Command = {
        name: 'move-up',
        execute: executeFn,
        aliases: ['k', 'up'],
        category: 'navigation',
        description: 'Move up',
      };

      registry.register(command);
      const context = createMockContext({ selectedNodeId: 'node-1' });

      await registry.execute('k', context);
      expect(executeFn).toHaveBeenCalled();

      vi.clearAllMocks();

      await registry.execute('up', context);
      expect(executeFn).toHaveBeenCalled();
    });
  });

  describe('Guard Validation Flow', () => {
    it('should prevent execution when guard fails', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const guardFn = vi.fn().mockReturnValue(false);

      const command: Command = {
        name: 'delete-node',
        execute: executeFn,
        guard: guardFn,
        category: 'editing',
        description: 'Delete node',
      };

      registry.register(command);
      const context = createMockContext({ selectedNodeId: null });

      const result = await registry.execute('delete-node', context);

      expect(guardFn).toHaveBeenCalledWith(context, {});
      expect(executeFn).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should allow execution when guard passes', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const guardFn = vi.fn().mockReturnValue(true);

      const command: Command = {
        name: 'delete-node',
        execute: executeFn,
        guard: guardFn,
        category: 'editing',
        description: 'Delete node',
      };

      registry.register(command);
      const context = createMockContext({ selectedNodeId: 'node-1' });

      const result = await registry.execute('delete-node', context);

      expect(guardFn).toHaveBeenCalledWith(context, {});
      expect(executeFn).toHaveBeenCalledWith(context, {});
      expect(result.success).toBe(true);
    });

    it('should validate guard before execution in canExecute', () => {
      const guardFn = vi.fn().mockReturnValue(false);
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const command: Command = {
        name: 'test-command',
        execute: executeFn,
        guard: guardFn,
        description: 'Test',
      };

      registry.register(command);
      const context = createMockContext();

      const canExecute = registry.canExecute('test-command', context);

      expect(guardFn).toHaveBeenCalledWith(context, {});
      expect(canExecute).toBe(false);
    });
  });

  describe('Command Chain Flow', () => {
    it('should execute multiple commands in sequence', async () => {
      const selectFn = vi.fn().mockResolvedValue({ success: true });
      const editFn = vi.fn().mockResolvedValue({ success: true });

      registry.register({
        name: 'select-node',
        execute: selectFn,
        description: 'Select',
      });

      registry.register({
        name: 'edit-node',
        execute: editFn,
        guard: (ctx) => ctx.selectedNodeId !== null,
        description: 'Edit',
      });

      const context = createMockContext({ selectedNodeId: null });

      // First select a node
      await registry.execute('select-node', context);
      expect(selectFn).toHaveBeenCalled();

      // Update context to simulate selection
      context.selectedNodeId = 'node-1';

      // Then edit it
      const result = await registry.execute('edit-node', context);
      expect(editFn).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle command execution errors gracefully', async () => {
      const error = new Error('Execution failed');
      const executeFn = vi.fn().mockRejectedValue(error);

      const command: Command = {
        name: 'failing-command',
        execute: executeFn,
        description: 'Failing',
      };

      registry.register(command);
      const result = await registry.execute('failing-command', createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should handle non-existent command gracefully', async () => {
      const result = await registry.execute('non-existent', createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle guard errors gracefully', async () => {
      const guardFn = vi.fn().mockImplementation(() => {
        throw new Error('Guard error');
      });

      const executeFn = vi.fn().mockResolvedValue({ success: true });

      const command: Command = {
        name: 'test-command',
        execute: executeFn,
        guard: guardFn,
        description: 'Test',
      };

      registry.register(command);

      // Guard errors are thrown, so we expect the execution to throw
      await expect(registry.execute('test-command', createMockContext())).rejects.toThrow('Guard error');
    });
  });

  describe('Command Discovery Flow', () => {
    beforeEach(() => {
      registry.register({
        name: 'move-up',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Move to the node above',
        aliases: ['k', 'up'],
      });

      registry.register({
        name: 'move-down',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Move to the node below',
        aliases: ['j', 'down'],
      });

      registry.register({
        name: 'delete-node',
        execute: vi.fn(),
        category: 'editing',
        description: 'Delete the selected node',
      });
    });

    it('should find commands by search', () => {
      const results = registry.search('move');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'move-up')).toBe(true);
      expect(results.some((r) => r.name === 'move-down')).toBe(true);
    });

    it('should find commands by category', () => {
      const navCommands = registry.getByCategory('navigation');

      expect(navCommands).toHaveLength(2);
      expect(navCommands.map((c) => c.name)).toContain('move-up');
      expect(navCommands.map((c) => c.name)).toContain('move-down');
    });

    it('should list all available command names', () => {
      const names = registry.getAvailableNames();

      expect(names).toContain('move-up');
      expect(names).toContain('move-down');
      expect(names).toContain('delete-node');
      // Note: getAvailableNames returns all names including aliases
      expect(names.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Real-world Workflow Scenarios', () => {
    it('should handle node editing workflow', async () => {
      const context = createMockContext({
        selectedNodeId: 'node-1',
        handlers: {
          ...createMockContext().handlers,
          selectNode: vi.fn(),
          startEdit: vi.fn(),
          updateNode: vi.fn(),
        },
      });

      // Register commands
      registry.register({
        name: 'select-node',
        execute: async (ctx) => {
          ctx.handlers.selectNode('node-1');
          return { success: true };
        },
        description: 'Select node',
      });

      registry.register({
        name: 'edit-node',
        execute: async (ctx) => {
          ctx.handlers.startEdit(ctx.selectedNodeId!);
          return { success: true };
        },
        guard: (ctx) => ctx.selectedNodeId !== null,
        description: 'Edit node',
      });

      registry.register({
        name: 'update-node',
        execute: async (ctx) => {
          ctx.handlers.updateNode(ctx.editingNodeId!, { text: 'Updated' });
          return { success: true };
        },
        guard: (ctx) => ctx.editingNodeId !== null,
        description: 'Update node',
      });

      // Execute workflow
      await registry.execute('select-node', context);
      expect(context.handlers.selectNode).toHaveBeenCalledWith('node-1');

      await registry.execute('edit-node', context);
      expect(context.handlers.startEdit).toHaveBeenCalledWith('node-1');

      context.editingNodeId = 'node-1';
      await registry.execute('update-node', context);
      expect(context.handlers.updateNode).toHaveBeenCalledWith('node-1', { text: 'Updated' });
    });

    it('should handle navigation workflow', async () => {
      const context = createMockContext({
        selectedNodeId: 'node-1',
        handlers: {
          ...createMockContext().handlers,
          navigateToDirection: vi.fn(),
          selectNode: vi.fn(),
        },
      });

      registry.register({
        name: 'move-up',
        execute: async (ctx) => {
          ctx.handlers.navigateToDirection('up');
          return { success: true };
        },
        guard: (ctx) => ctx.selectedNodeId !== null,
        description: 'Move up',
        aliases: ['k'],
      });

      const result = await registry.execute('k', context);

      expect(result.success).toBe(true);
      expect(context.handlers.navigateToDirection).toHaveBeenCalledWith('up');
    });
  });
});
