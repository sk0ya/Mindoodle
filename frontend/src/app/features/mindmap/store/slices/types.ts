import type { MindMapData, MindMapNode, Position, NodeLink } from '@shared/types';
import type { NormalizedData } from '../../../../core/data/normalizedStore';
import type { AISlice } from './aiSlice';
import type { SettingsSlice } from './settingsSlice';
import type { UISlice } from './uiSlice';
import type { UIState } from '@shared/types/ui.types';
import type { DataState as NodeDataState } from '@shared/types/nodeTypes';


export type { UIState };


export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}


export interface MindMapStore extends NodeDataState, HistoryState, AISlice, SettingsSlice, UISlice {
  normalizedData: NormalizedData | null;
  ui: UIState;
  
  
  setData: (data: MindMapData) => void;
  setRootNodes: (rootNodes: MindMapNode[]) => void;
  updateMapMetadata?: (updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  moveNodeWithPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => { success: boolean; reason?: string };
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
 toggleNodeCheckbox: (nodeId: string, isChecked: boolean) => void;
  
  
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
  commitSnapshot: () => void;
  scheduleCommitSnapshot: () => void;
  cancelPendingCommit: () => void;
  beginHistoryGroup?: (label?: string) => void;
  endHistoryGroup?: (commit?: boolean) => void;
  
  
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: (immediate?: boolean) => void;
  clearMermaidRelatedCaches: () => void;
  
  
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
  setShowNodeNotePanel?: (show: boolean) => void;
  toggleNodeNotePanel?: () => void;
  setShowVimSettingsPanel?: (show: boolean) => void;
  toggleVimSettingsPanel?: () => void;
  setShowKnowledgeGraph?: (show: boolean) => void;
  toggleKnowledgeGraph?: () => void;
  setMarkdownPanelWidth?: (width: number) => void;
  setNodeNotePanelHeight?: (height: number) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  setClipboard: (node: MindMapNode | null) => void;
  
  
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  
  closeAllPanels: () => void;
  toggleSidebar: () => void;
}
