/**
 * MindMap Store Types - Zustandストア関連の型定義
 */

import type { MindMapData, MindMapNode, NodeLink, Position } from '@shared/types';
import type { UIState } from '@shared/types';

// Normalized data type (外部依存)
export interface NormalizedData {
  [key: string]: any; // from normalizedStore
}

// Data State types
export interface DataState {
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  // Keep track of the node that triggered an insert (o/O/Enter/Tab) so we can restore selection on cancel
  lastSelectionBeforeInsert?: string | null;
}

// History State types
export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}

// Node Operations interface
export interface NodeOperations {
  // Basic node operations
  addNode: (parentId: string, text?: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;

  // Node queries
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];

  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
}

// Link Operations interface
export interface LinkOperations {
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
}

// Node Actions interface combining all node-related operations
export interface NodeActions extends NodeOperations, LinkOperations {
  // Data management
  setData: (data: MindMapData) => void;

  // Layout
  applyAutoLayout: () => void;

  // Utility
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
}

// Combined Node Slice interface
export interface NodeSlice extends NodeActions {
  // State
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  lastSelectionBeforeInsert?: string | null;
}

// AI Slice type (簡易版)
export interface AISlice {
  // AI関連の状態とアクション（実装詳細は省略）
  [key: string]: any;
}

// Settings Slice type (簡易版)
export interface SettingsSlice {
  // 設定関連の状態とアクション（実装詳細は省略）
  [key: string]: any;
}

// UI Slice type (再エクスポート)
export interface UISlice {
  ui: UIState;
  // UI関連のアクション
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;
  setShowCustomizationPanel: (show: boolean) => void;
  setCustomizationPosition: (position: Position) => void;
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

  // Icon-triggered displays
  setShowAttachmentListForNode: (nodeId: string | null) => void;
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleAttachmentListForNode: (nodeId: string) => void;
  toggleLinkListForNode: (nodeId: string) => void;

  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
}

// Combined Store Interface
export interface MindMapStore extends DataState, HistoryState, AISlice, SettingsSlice, UISlice {
  ui: UIState;

  // Data Actions
  setData: (data: MindMapData) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;

  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];

  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Utility
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;

  // UI Actions (詳細は UISlice から継承)
  closeAttachmentAndLinkLists: () => void;
}