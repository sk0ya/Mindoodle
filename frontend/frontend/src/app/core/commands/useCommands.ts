/**
 * useCommands Hook
 * React hook for integrating the command system with the mindmap application
 */

import { useCallback, useEffect, useMemo } from 'react';
import type {
  CommandContext,
  CommandResult,
  ParseResult,
  ExecuteOptions
} from './types';
import { parseCommand, validateCommand, generateSuggestions } from './parser';
import { getCommandRegistry } from './registry';
import { commands, registerAllCommands } from './commands';
import type { VimModeHook } from '../hooks/useVimMode';

interface UseCommandsProps {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  handlers: {
    updateNode: (id: string, updates: any) => void;
    deleteNode: (id: string) => void;
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    findNodeById: (nodeId: string) => any;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    copyNode: (nodeId: string) => void;
    pasteNode: (parentId: string) => Promise<void>;
    undo: () => void;
    redo: () => void;
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
}

/**
 * Hook for using the command system in React components
 */
export function useCommands(props: UseCommandsProps): UseCommandsReturn {
  const { selectedNodeId, editingNodeId, vim, handlers } = props;

  // Initialize command registry
  const registry = useMemo(() => {
    const reg = getCommandRegistry();

    // Register all commands if not already registered
    try {
      registerAllCommands(reg);
    } catch (error) {
      // Commands might already be registered, which is fine
      console.debug('Commands already registered:', error);
    }

    return reg;
  }, []);

  // Create command context
  const context = useMemo((): CommandContext => ({
    selectedNodeId,
    editingNodeId,
    vim,
    handlers
  }), [selectedNodeId, editingNodeId, vim, handlers]);

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
        console.log(`Command executed: ${commandString}`, result);
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
    const vimCommandMap: Record<string, string> = {
      'zz': 'center',
      'dd': 'delete',
      'za': 'toggle',
      'ciw': 'edit',
      'i': 'insert',
      'a': 'append',
      'o': 'open',
      'h': 'left',
      'j': 'down',
      'k': 'up',
      'l': 'right'
    };

    const commandName = vimCommandMap[vimKey];
    if (!commandName) {
      return {
        success: false,
        error: `Unknown vim command: ${vimKey}`
      };
    }

    return execute(commandName);
  }, [execute]);

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

  return {
    execute,
    parse,
    getAvailableCommands,
    getSuggestions,
    getHelp,
    isValidCommand,
    executeVimCommand
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