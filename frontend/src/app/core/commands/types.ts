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
    // Node operations
    updateNode: (id: string, updates: Partial<MindMapNode>) => void;
    deleteNode: (id: string) => void;
    findNodeById: (nodeId: string) => MindMapNode | null;

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

// Comprehensive command handlers interface for keyboard shortcuts
export interface CommandHandlers {
  // Node operations
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (id: string) => void;
  findNodeById: (nodeId: string) => MindMapNode | null;

  // Navigation
  centerNodeInView?: (nodeId: string, animate?: boolean) => void;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;

  // Editing
  startEdit: (nodeId: string) => void;
  startEditWithCursorAtStart: (nodeId: string) => void;
  startEditWithCursorAtEnd: (nodeId: string) => void;

  // Structure operations
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;

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
}