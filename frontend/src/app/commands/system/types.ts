
import type { MindMapNode, UIMode, PanelId } from '@shared/types';
import type { VimModeHook } from '@vim/hooks/useVimMode';


export type CommandArgType = 'string' | 'number' | 'boolean' | 'node-id';

// Centralized literal unions and arg map
export type Direction = 'up' | 'down' | 'left' | 'right';
export type InsertPosition = 'before' | 'after' | 'child';
export type MarkdownNodeType = 'heading' | 'unordered-list' | 'ordered-list';
export type CommandCategory =
  | 'navigation'
  | 'editing'
  | 'structure'
  | 'vim'
  | 'utility'
  | 'ui'
  | 'application';

export type ArgPrimitive = string | number | boolean;
export type ArgsMap = Record<string, ArgPrimitive>;

export interface CommandArg {
  name: string;
  type: CommandArgType;
  required?: boolean;
  description?: string;
  default?: string | number | boolean;
}


export interface CommandContext {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  
  count?: number;
  
  mode?: UIMode;
  openPanels?: Partial<Record<PanelId, boolean>>;
  
  handlers: {

    updateNode: (_id: string, _updates: Partial<MindMapNode>) => void;
    deleteNode: (_id: string) => void;
    findNodeById: (_nodeId: string) => MindMapNode | null;
    findParentNode?: (_nodeId: string) => MindMapNode | null;


    centerNodeInView?: (_nodeId: string, _animate?: boolean) => void;
    navigateToDirection: (direction: Direction, count?: number) => void;
    selectNode: (nodeId: string | null) => void;
    setPan?: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    
    startEdit: (nodeId: string) => void;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;

    
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean, insertAfter?: boolean) => Promise<string | null>;
    changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
    moveNode?: (nodeId: string, newParentId: string) => Promise<void>;
    moveNodeWithPosition?: (nodeId: string, targetNodeId: string, position: InsertPosition) => Promise<void>;

    
    copyNode: (nodeId: string) => void;
    copyNodeText: (nodeId: string) => Promise<void>;
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

    
    onMarkdownNodeType?: (nodeId: string, newType: MarkdownNodeType) => void;

    
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
  category?: CommandCategory;

  guard?: (context: CommandContext, args: ArgsMap) => boolean;
  execute: (context: CommandContext, args: ArgsMap) => Promise<CommandResult> | CommandResult;
  
  repeatable?: boolean; 
  countable?: boolean;  
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
  execute: (nameOrAlias: string, context: CommandContext, args?: ArgsMap) => Promise<CommandResult>;
}


export interface ExecuteOptions {
  dryRun?: boolean;
  verbose?: boolean;
  confirm?: boolean;
}
