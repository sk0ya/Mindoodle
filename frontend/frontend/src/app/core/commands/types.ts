/**
 * Command System Types
 * Defines the structure and interfaces for the command-based operation system
 */

import type { MindMapNode } from '@shared/types';
import type { VimModeHook } from '../hooks/useVimMode';

// Command argument type definitions
export type CommandArgType = 'string' | 'number' | 'boolean' | 'node-id';

export interface CommandArg {
  name: string;
  type: CommandArgType;
  required?: boolean;
  description?: string;
  default?: any;
}

// Command execution context
export interface CommandContext {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  // Handler functions from useShortcutHandlers
  handlers: {
    updateNode: (id: string, updates: Partial<MindMapNode>) => void;
    deleteNode: (id: string) => void;
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    findNodeById: (nodeId: string) => MindMapNode | null;
    startEditWithCursorAtStart: (nodeId: string) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    copyNode: (nodeId: string) => void;
    pasteNode: (parentId: string) => Promise<void>;
    undo: () => void;
    redo: () => void;
  };
}

// Command execution result
export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Command definition
export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  args?: CommandArg[];
  examples?: string[];
  category?: 'navigation' | 'editing' | 'structure' | 'vim' | 'utility';
  execute: (context: CommandContext, args: Record<string, any>) => Promise<CommandResult> | CommandResult;
}

// Parsed command from user input
export interface ParsedCommand {
  name: string;
  args: Record<string, any>;
  rawInput: string;
}

// Command parsing result
export interface ParseResult {
  success: boolean;
  command?: ParsedCommand;
  error?: string;
  suggestions?: string[];
}

// Command registry interface
export interface CommandRegistry {
  register: (command: Command) => void;
  unregister: (name: string) => void;
  get: (name: string) => Command | undefined;
  getAll: () => Command[];
  getByCategory: (category: string) => Command[];
  search: (query: string) => Command[];
}

// Command execution options
export interface ExecuteOptions {
  dryRun?: boolean;
  verbose?: boolean;
  confirm?: boolean;
}