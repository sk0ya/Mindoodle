import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistryImpl, resetCommandRegistry } from './registry';
import type { Command, CommandContext } from './types';

// Helper to create minimal valid CommandContext
const createContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
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

describe('CommandRegistryImpl', () => {
  let registry: CommandRegistryImpl;

  beforeEach(() => {
    resetCommandRegistry();
    registry = new CommandRegistryImpl();
  });

  describe('register', () => {
    it('should register a command', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Test command',
      };

      registry.register(command);
      const retrieved = registry.get('test-command');

      expect(retrieved).toBe(command);
    });

    it('should register command with aliases', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        aliases: ['tc', 'test'],
        description: 'Test command with aliases',
      };

      registry.register(command);

      expect(registry.get('test-command')).toBe(command);
      expect(registry.get('tc')).toBe(command);
      expect(registry.get('test')).toBe(command);
    });

    it('should throw error when registering duplicate command', () => {
      const command1: Command = {
        name: 'test-command',
        execute: vi.fn(),
        description: 'First command',
      };
      const command2: Command = {
        name: 'test-command',
        execute: vi.fn(),
        description: 'Second command',
      };

      registry.register(command1);
      expect(() => registry.register(command2)).toThrow('already registered');
    });

    it('should handle commands without optional fields', () => {
      const command: Command = {
        name: 'minimal-command',
        execute: vi.fn(),
        description: 'Minimal command',
      };

      registry.register(command);
      expect(registry.get('minimal-command')).toBe(command);
    });
  });

  describe('get', () => {
    it('should retrieve command by name', () => {
      const command: Command = {
        name: 'my-command',
        execute: vi.fn(),
        description: 'My command',
      };

      registry.register(command);
      expect(registry.get('my-command')).toBe(command);
    });

    it('should retrieve command by alias', () => {
      const command: Command = {
        name: 'my-command',
        execute: vi.fn(),
        aliases: ['mc'],
        description: 'My command',
      };

      registry.register(command);
      expect(registry.get('mc')).toBe(command);
    });

    it('should return undefined for non-existent command', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('unregister', () => {
    it('should unregister command by name', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        description: 'Test command',
      };

      registry.register(command);
      registry.unregister('test-command');

      expect(registry.get('test-command')).toBeUndefined();
    });

    it('should unregister all aliases', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        aliases: ['tc', 'test'],
        description: 'Test command',
      };

      registry.register(command);
      registry.unregister('test-command');

      expect(registry.get('test-command')).toBeUndefined();
      expect(registry.get('tc')).toBeUndefined();
      expect(registry.get('test')).toBeUndefined();
    });

    it('should not throw when unregistering non-existent command', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should execute command with context', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const command: Command = {
        name: 'test-command',
        execute: executeFn,
        description: 'Test command',
      };
      const context = createContext({ selectedNodeId: 'node-1' });

      registry.register(command);
      const result = await registry.execute('test-command', context);

      expect(result.success).toBe(true);
      expect(executeFn).toHaveBeenCalledWith(context, {});
    });

    it('should check guard before execution', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const guardFn = vi.fn().mockReturnValue(false);
      const command: Command = {
        name: 'test-command',
        execute: executeFn,
        guard: guardFn,
        description: 'Test command',
      };
      const context = createContext({ selectedNodeId: null });

      registry.register(command);
      const result = await registry.execute('test-command', context);

      expect(guardFn).toHaveBeenCalledWith(context, {});
      expect(executeFn).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should execute when guard passes', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const guardFn = vi.fn().mockReturnValue(true);
      const command: Command = {
        name: 'test-command',
        execute: executeFn,
        guard: guardFn,
        description: 'Test command',
      };
      const context = createContext({ selectedNodeId: 'node-1' });

      registry.register(command);
      const result = await registry.execute('test-command', context);

      expect(guardFn).toHaveBeenCalledWith(context, {});
      expect(executeFn).toHaveBeenCalledWith(context, {});
      expect(result.success).toBe(true);
    });

    it('should return error for non-existent command', async () => {
      const result = await registry.execute('non-existent', createContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle errors during execution', async () => {
      const error = new Error('Execution failed');
      const executeFn = vi.fn().mockRejectedValue(error);
      const command: Command = {
        name: 'failing-command',
        execute: executeFn,
        description: 'Failing command',
      };

      registry.register(command);
      const result = await registry.execute('failing-command', createContext());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('canExecute', () => {
    it('should return true when guard passes', () => {
      const guardFn = vi.fn().mockReturnValue(true);
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        guard: guardFn,
        description: 'Test command',
      };

      registry.register(command);
      const context = createContext({ selectedNodeId: 'test-node' });
      const result = registry.canExecute('test-command', context);

      expect(result).toBe(true);
      expect(guardFn).toHaveBeenCalledWith(context, {});
    });

    it('should return false when guard fails', () => {
      const guardFn = vi.fn().mockReturnValue(false);
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        guard: guardFn,
        description: 'Test command',
      };

      registry.register(command);
      const result = registry.canExecute('test-command', createContext());

      expect(result).toBe(false);
    });

    it('should return true when no guard exists', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        description: 'Test command',
      };

      registry.register(command);
      const result = registry.canExecute('test-command', createContext());

      expect(result).toBe(true);
    });

    it('should return false for non-existent command', () => {
      const result = registry.canExecute('non-existent', createContext());
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all registered commands', () => {
      const command1: Command = {
        name: 'command-1',
        execute: vi.fn(),
        description: 'Command 1',
      };
      const command2: Command = {
        name: 'command-2',
        execute: vi.fn(),
        description: 'Command 2',
      };

      registry.register(command1);
      registry.register(command2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(command1);
      expect(all).toContain(command2);
    });

    it('should return empty array when no commands registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should not include duplicate commands with aliases', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        aliases: ['tc', 'test'],
        description: 'Test command',
      };

      registry.register(command);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(command);
    });
  });

  describe('getByCategory', () => {
    it('should return commands by category', () => {
      const navCommand: Command = {
        name: 'move-up',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Move up',
      };
      const editCommand: Command = {
        name: 'delete-node',
        execute: vi.fn(),
        category: 'editing',
        description: 'Delete node',
      };

      registry.register(navCommand);
      registry.register(editCommand);

      const navCommands = registry.getByCategory('navigation');
      expect(navCommands).toHaveLength(1);
      expect(navCommands[0]).toBe(navCommand);
    });

    it('should return empty array for unknown category', () => {
      expect(registry.getByCategory('unknown')).toEqual([]);
    });

    it('should return empty array when no commands in category', () => {
      const command: Command = {
        name: 'test-command',
        execute: vi.fn(),
        category: 'utility',
        description: 'Test command',
      };

      registry.register(command);
      expect(registry.getByCategory('navigation')).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register({
        name: 'move-up',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Move to the node above',
      });
      registry.register({
        name: 'move-down',
        execute: vi.fn(),
        category: 'navigation',
        description: 'Move to the node below',
      });
      registry.register({
        name: 'delete-node',
        execute: vi.fn(),
        category: 'editing',
        description: 'Delete the selected node',
      });
    });

    it('should find commands by name', () => {
      const results = registry.search('move');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name === 'move-up')).toBe(true);
      expect(results.some(r => r.name === 'move-down')).toBe(true);
    });

    it('should find commands by description', () => {
      const results = registry.search('delete');
      expect(results.some(r => r.name === 'delete-node')).toBe(true);
    });

    it('should find commands by category', () => {
      const results = registry.search('navigation');
      expect(results.some(r => r.name === 'move-up')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('xyz123');
      expect(results).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const results = registry.search('MOVE');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableNames', () => {
    it('should return all command names', () => {
      registry.register({ name: 'command-1', execute: vi.fn(), description: 'Command 1' });
      registry.register({ name: 'command-2', execute: vi.fn(), description: 'Command 2' });
      registry.register({ name: 'command-3', execute: vi.fn(), description: 'Command 3' });

      const names = registry.getAvailableNames();
      expect(names).toContain('command-1');
      expect(names).toContain('command-2');
      expect(names).toContain('command-3');
      expect(names).toHaveLength(3);
    });

    it('should return empty array when no commands', () => {
      expect(registry.getAvailableNames()).toEqual([]);
    });
  });
});
