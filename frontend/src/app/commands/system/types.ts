
import type { MindMapNode, UIMode, PanelId } from '@shared/types';
import type { VimModeHook } from '@vim/hooks/useVimMode';


export type CommandArgType = 'string' | 'number' | 'boolean' | 'node-id';

export interface CommandArg {
  name: string;
  type: CommandArgType;
  required?: boolean;
  description?: string;
  default?: any;
}


export interface CommandContext {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  
  count?: number;
  
  mode?: UIMode;
  openPanels?: Partial<Record<PanelId, boolean>>;
  
  handlers: {
    
    updateNode: (id: string, updates: Partial<MindMapNode>) => void;
    deleteNode: (id: string) => void;
    findNodeById: (nodeId: string) => MindMapNode | null;
    findParentNode?: (nodeId: string) => MindMapNode | null;

    
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right', count?: number) => void;
    selectNode: (nodeId: string | null) => void;
    setPan?: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    
    startEdit: (nodeId: string) => void;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;

    
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean, insertAfter?: boolean) => Promise<string | null>;
    changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
    moveNode?: (nodeId: string, newParentId: string) => Promise<void>;
    moveNodeWithPosition?: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => Promise<void>;

    
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
    
    showNotesPanel?: boolean;
    setShowNotesPanel?: (show: boolean) => void;
    toggleNotesPanel?: () => void;
    
    showNodeNotePanel?: boolean;
    setShowNodeNotePanel?: (show: boolean) => void;
    toggleNodeNotePanel?: () => void;
    
    showKnowledgeGraph?: boolean;
    setShowKnowledgeGraph?: (show: boolean) => void;
    toggleKnowledgeGraph?: () => void;

    
    closeAttachmentAndLinkLists: () => void;

    
    onMarkdownNodeType?: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;

    
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
  category?: 'navigation' | 'editing' | 'structure' | 'vim' | 'utility' | 'ui' | 'application';
  
  guard?: (context: CommandContext, args: Record<string, any>) => boolean;
  execute: (context: CommandContext, args: Record<string, any>) => Promise<CommandResult> | CommandResult;
  
  repeatable?: boolean; 
  countable?: boolean;  
}


export interface ParsedCommand {
  name: string;
  args: Record<string, any>;
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
  execute: (nameOrAlias: string, context: CommandContext, args?: Record<string, any>) => Promise<CommandResult>;
}


export interface ExecuteOptions {
  dryRun?: boolean;
  verbose?: boolean;
  confirm?: boolean;
}
