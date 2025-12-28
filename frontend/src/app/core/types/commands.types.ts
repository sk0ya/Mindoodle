

import type { MindMapNode } from '@shared/types';


export type CommandArgType = 'string' | 'number' | 'boolean' | 'node-id';
export type ArgPrimitive = string | number | boolean;
export type ArgsMap = Record<string, ArgPrimitive>;

export interface CommandArg {
  name: string;
  type: CommandArgType;
  required?: boolean;
  description?: string;
  default?: ArgPrimitive;
}


export interface VimModeHook {
  mode: 'normal' | 'insert' | 'visual' | 'command';
  isActive: boolean;
  setMode: (mode: 'normal' | 'insert' | 'visual' | 'command') => void;
  enable: () => void;
  disable: () => void;
}


export interface CommandContext {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  
  handlers: {
    
    updateNode: (id: string, updates: Partial<MindMapNode>) => void;
    deleteNode: (id: string) => void;
    findNodeById: (nodeId: string) => MindMapNode | null;

    
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    selectNode: (nodeId: string | null) => void;
    setPan?: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    
    startEdit: (nodeId: string) => void;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;

    
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean, insertAfter?: boolean) => Promise<string | null>;
    changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;

    
    copyNode: (nodeId: string) => void;
    pasteNode: (parentId: string) => Promise<void>;
    pasteImageFromClipboard: (nodeId: string, file?: File) => Promise<void>;

    
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    
    showKeyboardHelper: boolean;
    setShowKeyboardHelper: (show: boolean) => void;
    showMapList: boolean;
    setShowMapList: (show: boolean) => void;
    showLocalStorage: boolean;
    setShowLocalStorage: (show: boolean) => void;
    showTutorial: boolean;
    setShowTutorial: (show: boolean) => void;

    
    closeAttachmentAndLinkLists: () => void;

    
    onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list', options?: { isCheckbox?: boolean; isChecked?: boolean }) => void;

    
    switchToNextMap?: () => void;
    switchToPrevMap?: () => void;
  };
}


export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
}


export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  args?: CommandArg[];
  examples?: string[];
  category?: 'navigation' | 'editing' | 'structure' | 'vim' | 'utility';
  execute: (context: CommandContext, args: ArgsMap) => Promise<CommandResult> | CommandResult;
}


export interface ParsedCommand {
  name: string;
  args: ArgsMap;
  rawInput: string;
}


export interface ParseResult {
  success: boolean;
  command?: ParsedCommand;
  error?: string;
  suggestions?: string[];
}


export interface CommandRegistry {
  register: (command: Command) => void;
  unregister: (name: string) => void;
  get: (name: string) => Command | undefined;
  getAll: () => Command[];
  getByCategory: (category: string) => Command[];
  search: (query: string) => Command[];
}


export interface ExecuteOptions {
  dryRun?: boolean;
  verbose?: boolean;
  confirm?: boolean;
}


export interface CommandHandlers {
  
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (id: string) => void;
  findNodeById: (nodeId: string) => MindMapNode | null;

  
  centerNodeInView?: (nodeId: string, animate?: boolean) => void;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;

  
  startEdit: (nodeId: string) => void;
  startEditWithCursorAtStart: (nodeId: string) => void;
  startEditWithCursorAtEnd: (nodeId: string) => void;

  
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;

  
  copyNode: (nodeId: string) => void;
  pasteNode: (parentId: string) => Promise<void>;
  pasteImageFromClipboard: (nodeId: string, file?: File) => Promise<void>;

  
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (show: boolean) => void;
  showMapList: boolean;
  setShowMapList: (show: boolean) => void;
  showLocalStorage: boolean;
  setShowLocalStorage: (show: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;

  
  closeAttachmentAndLinkLists: () => void;

  
  onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
}
