

import type { MindMapData, MindMapNode, NodeLink, Position, UIState } from '@shared/types';


export interface NormalizedData {
  [key: string]: any; 
}


export interface DataState {
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  
  lastSelectionBeforeInsert?: string | null;
}


export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}


export interface NodeOperations {
  
  addNode: (parentId: string, text?: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;

  
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];

  
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
}


export interface LinkOperations {
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
}


export interface NodeActions extends NodeOperations, LinkOperations {
  
  setData: (data: MindMapData) => void;

  
  applyAutoLayout: () => void;

  
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
}


export interface NodeSlice extends NodeActions {
  
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  lastSelectionBeforeInsert?: string | null;
}


export interface AISlice {
  
  [key: string]: any;
}


export interface SettingsSlice {
  
  [key: string]: any;
}


export interface UISlice {
  ui: UIState;
  
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;
  setShowContextMenu: (show: boolean) => void;
  setContextMenuPosition: (position: Position) => void;
  setShowShortcutHelper: (show: boolean) => void;
  setShowMapList: (show: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setShowNotesPanel: (show: boolean) => void;
  toggleNotesPanel: () => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  setClipboard: (node: MindMapNode | null) => void;

  
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleLinkListForNode: (nodeId: string) => void;

  closeAllPanels: () => void;
  toggleSidebar: () => void;
}


export interface MindMapStore extends DataState, HistoryState, AISlice, SettingsSlice, UISlice {
  ui: UIState;

  
  setData: (data: MindMapData) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;

  
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;

  
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];

  
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
}
