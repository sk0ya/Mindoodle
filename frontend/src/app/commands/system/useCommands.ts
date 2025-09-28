/**
 * useCommands Hook
 * React hook for integrating the command system with the mindmap application
 */

import { useCallback, useMemo } from 'react';
import type {
  CommandContext,
  CommandResult,
  ParseResult,
  ExecuteOptions
} from './types';
import { parseCommand, validateCommand, generateSuggestions } from './parser';
import { CommandRegistryImpl } from './registry';
import { registerAllCommands } from '../index';
import { parseVimSequence, getVimKeys, type VimSequenceResult } from './vimSequenceParser';
import { logger } from '@shared/utils';
import { useMindMapStore } from '@mindmap/store';
import type { VimModeHook } from '@vim/hooks/useVimMode';

interface UseCommandsProps {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  handlers: {
    // Node operations
    updateNode: (id: string, updates: any) => void;
    deleteNode: (id: string) => void;
    findNodeById: (nodeId: string) => any;

    // Navigation
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    selectNode: (nodeId: string | null) => void;
    setPan?: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    // Editing
    startEdit: (nodeId: string) => void;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;

    // Structure operations
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean, insertAfter?: boolean) => Promise<string | null>;
    changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;

    // Clipboard operations
    copyNode: (nodeId: string) => void;
    pasteNode: (parentId: string) => Promise<void>;
    pasteImageFromClipboard: (nodeId: string) => Promise<void>;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // UI state management
    showKeyboardHelper: boolean;
    setShowKeyboardHelper: (show: boolean) => void;
    showMapList: boolean;
    setShowMapList: (show: boolean) => void;
    showLocalStorage: boolean;
    setShowLocalStorage: (show: boolean) => void;
    showTutorial: boolean;
    setShowTutorial: (show: boolean) => void;

    // UI operations
    closeAttachmentAndLinkLists: () => void;

    // Markdown operations
    onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  };
}

export interface UseCommandsReturn {
  execute: (commandString: string, options?: ExecuteOptions) => Promise<CommandResult>;
  parse: (commandString: string) => ParseResult;
  getAvailableCommands: () => string[];
  getSuggestions: (partialInput: string) => string[];
  getHelp: (commandName?: string) => string;
  isValidCommand: (commandName: string) => boolean;
  executeVimCommand: (vimKey: string) => Promise<CommandResult>;
  parseVimSequence: (sequence: string) => VimSequenceResult;
  getVimKeys: () => string[];
}

/**
 * Hook for using the command system in React components
 */
export function useCommands(props: UseCommandsProps): UseCommandsReturn {
  const { selectedNodeId, editingNodeId, vim, handlers } = props;

  // Initialize command registry (local instance, not global)
  const registry = useMemo(() => {
    const reg = new CommandRegistryImpl();

    registerAllCommands(reg);

    return reg;
  }, []);

  // Create command context
  const context = useMemo((): CommandContext => {
    // Strip undefineds from handlers to satisfy exactOptionalPropertyTypes
    const cleanHandlers = Object.entries(handlers).reduce((acc, [k, v]) => {
      if (v !== undefined) (acc as any)[k] = v;
      return acc;
    }, {} as Partial<CommandContext['handlers']>) as CommandContext['handlers'];

    const base = { selectedNodeId, editingNodeId, handlers: cleanHandlers } as CommandContext;
    if (vim !== undefined) {
      (base as any).vim = vim;
    }
    return base;
  }, [selectedNodeId, editingNodeId, vim, handlers]);

  // Parse command string
  const parse = useCallback((commandString: string): ParseResult => {
    return parseCommand(commandString);
  }, []);

  // Execute command
  const execute = useCallback(async (
    commandString: string,
    options: ExecuteOptions = {}
  ): Promise<CommandResult> => {
    try {
      // Parse command
      const parseResult = parseCommand(commandString);
      if (!parseResult.success || !parseResult.command) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse command'
        };
      }

      // Get command from registry
      const command = registry.get(parseResult.command.name);
      if (!command) {
        const suggestions = generateSuggestions(parseResult.command.name, registry.getAll());
        return {
          success: false,
          error: `Command '${parseResult.command.name}' not found${
            suggestions.length > 0 ? `. Did you mean: ${suggestions.slice(0, 3).join(', ')}?` : ''
          }`
        };
      }

      // Validate command arguments
      const validationResult = validateCommand(parseResult.command, command);
      if (!validationResult.success || !validationResult.command) {
        return {
          success: false,
          error: validationResult.error || 'Command validation failed'
        };
      }

      // Dry run mode
      if (options.dryRun) {
        return {
          success: true,
          message: `Would execute: ${command.name} with args: ${JSON.stringify(validationResult.command.args)}`
        };
      }

      // Execute command
      const result = await command.execute(context, validationResult.command.args);

      if (options.verbose && result.success) {
        logger.debug(`Command executed: ${commandString}`, result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing command'
      };
    }
  }, [context, registry]);

  // Execute vim-specific commands
  const executeVimCommand = useCallback(async (vimKey: string): Promise<CommandResult> => {
    // Numeric-prefixed ordered-list conversion: "<number>m"
    // parseVimSequence encodes as 'm:<num>'
    if (/^m:\d+$/.test(vimKey)) {
      try {
        const num = parseInt(vimKey.split(':')[1], 10);
        if (!selectedNodeId || !handlers.findNodeById) {
          return { success: false, error: 'No node selected' };
        }
        const node = handlers.findNodeById(selectedNodeId);
        if (!node) {
          return { success: false, error: 'Selected node not found' };
        }

        // Determine target level and indent based on current meta and parent
        // 既定はトップレベルのリスト（level=1, indent=0）
        let level = 1;
        // indentLevel はスペース数（1レベル=2スペース）
        let indentLevel = 0;

        // Try to derive from parent when possible
        try {
          const roots: any[] = (useMindMapStore as any).getState?.().data?.rootNodes || [];
          // Lightweight parent search
          const findParent = (list: any[], targetId: string, parent: any | null = null): any | null => {
            for (const n of list) {
              if (n.id === targetId) return parent;
              if (n.children?.length) {
                const p = findParent(n.children, targetId, n);
                if (p) return p;
              }
            }
            return null;
          };
          const parent = findParent(roots, selectedNodeId);
          if (parent?.markdownMeta && (parent.markdownMeta.type === 'ordered-list' || parent.markdownMeta.type === 'unordered-list')) {
            level = Math.max((parent.markdownMeta.level || 1) + 1, 1);
            indentLevel = Math.max(level - 1, 0) * 2;
          }
        } catch { /* ignore parent derivation errors */ }

        const newMeta = {
          type: 'ordered-list' as const,
          level,
          originalFormat: `${Math.max(1, num)}.`,
          indentLevel,
          lineNumber: node.markdownMeta?.lineNumber ?? 0
        };

        // Update only this node's markdownMeta to ordered-list with the specified number
        handlers.updateNode(selectedNodeId, { markdownMeta: newMeta } as any);

        return { success: true, message: `Converted to ${num}. ordered list` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to set ordered number' };
      }
    }

    
    // Handle search commands specially
    if (vimKey === '/' && vim) {
      vim.startSearch();
      return { success: true };
    }

    if (vimKey === 'n' && vim && vim.mode === 'normal') {
      vim.nextSearchResult();
      return { success: true };
    }

    if (vimKey === 'N' && vim && vim.mode === 'normal') {
      vim.previousSearchResult();
      return { success: true };
    }

    if (vimKey === 's' && vim && vim.mode === 'normal') {
      vim.startJumpy();
      return { success: true };
    }

    const vimCommandMap: Record<string, string> = {
      'zz': 'center',
      'zt': 'center-left',
      'dd': 'cut',
      'yy': 'copy',
      'za': 'toggle',
      'zo': 'expand',
      'zc': 'collapse',
      'zR': 'expand-all',
      'zM': 'collapse-all',
      'gg': 'select-root',
      'gt': 'next-map',
      'gT': 'prev-map',
      'ctrl-u': 'scroll-up',
      'ctrl-d': 'scroll-down',
      'ctrl-r': 'redo',      // Ctrl+R for redo
      'ciw': 'edit',
      'i': 'append',        // i: 末尾カーソル編集
      'a': 'add-child',     // a: 子ノード追加
      'A': 'append-end',
      'I': 'insert',        // I: 先頭カーソル編集
      'o': 'open',
      'O': 'open-above',
      'h': 'left',
      'j': 'down',
      'k': 'up',
      'l': 'right',
      'p': 'paste',
      'tab': 'add-child',
      'enter': 'add-sibling',
      'm': 'convert',
      'M': 'select-center',
      'G': 'select-bottom',
      '0': 'select-current-root',
      'delete': 'delete',
      'backspace': 'delete',
      'x': 'toggle-checkbox',
      'u': 'undo',          // u for undo
      '>>': 'move-as-child-of-sibling',
      '<<': 'move-as-next-sibling-of-parent'
    };

    const commandName = vimCommandMap[vimKey];

    if (!commandName) {
      console.error('Unknown vim command:', vimKey);
      return {
        success: false,
        error: `Unknown vim command: ${vimKey}`
      };
    }

    const result = await execute(commandName);
    return result;
  }, [execute, vim]);

  // Get available command names
  const getAvailableCommands = useCallback((): string[] => {
    return registry.getAvailableNames();
  }, [registry]);

  // Get command suggestions
  const getSuggestions = useCallback((partialInput: string): string[] => {
    return generateSuggestions(partialInput, registry.getAll());
  }, [registry]);

  // Get help for commands
  const getHelp = useCallback((commandName?: string): string => {
    return registry.getHelp(commandName);
  }, [registry]);

  // Check if command is valid
  const isValidCommand = useCallback((commandName: string): boolean => {
    return registry.get(commandName) !== undefined;
  }, [registry]);

  // Parse vim sequence using vim sequence parser
  const parseVimSequenceCallback = useCallback((sequence: string): VimSequenceResult => {
    return parseVimSequence(sequence);
  }, []);

  // Get vim keys that should prevent default behavior
  const getVimKeysCallback = useCallback((): string[] => {
    return getVimKeys();
  }, []);

  return {
    execute,
    parse,
    getAvailableCommands,
    getSuggestions,
    getHelp,
    isValidCommand,
    executeVimCommand,
    parseVimSequence: parseVimSequenceCallback,
    getVimKeys: getVimKeysCallback
  };
}

// Export for backward compatibility with existing vim system
export function useVimCommands(props: UseCommandsProps) {
  const commands = useCommands(props);

  return {
    ...commands,
    // Convenience methods for vim commands
    center: () => commands.executeVimCommand('zz'),
    delete: () => commands.executeVimCommand('dd'),
    toggle: () => commands.executeVimCommand('za'),
    edit: () => commands.executeVimCommand('ciw'),
    insert: () => commands.executeVimCommand('i'),
    append: () => commands.executeVimCommand('a'),
    open: () => commands.executeVimCommand('o'),
    navigateUp: () => commands.executeVimCommand('k'),
    navigateDown: () => commands.executeVimCommand('j'),
    navigateLeft: () => commands.executeVimCommand('h'),
    navigateRight: () => commands.executeVimCommand('l'),
  };
}
