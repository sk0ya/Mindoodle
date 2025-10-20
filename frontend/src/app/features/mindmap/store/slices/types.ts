import type { MindMapData, MindMapNode, Position, NodeLink } from '@shared/types';
import type { NormalizedData } from '../../../../core/data/normalizedStore';
import type { UIState, UIActions } from '@shared/types/ui.types';
import type { StorageMode } from '@core/types';

export type { UIState };

// Define slice interfaces here to avoid circular dependencies
export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  fontFamily: string;
  nodeSpacing: number;
  nodeTextWrapEnabled: boolean;
  nodeTextWrapWidth: number;
  storageMode: StorageMode;
  cloudApiEndpoint?: string;
  vimMindMap: boolean;
  vimEditor: boolean;
  vimLeader: string;
  vimCustomKeybindings: Record<string, string>;
  vimMappingsSource: string;
  vimEditorLeader: string;
  vimEditorCustomKeybindings: Record<string, string>;
  vimEditorMappingsSource: string;
  previewMode: boolean;
  addBlankLineAfterHeading: boolean;
  defaultCollapseDepth?: number;
  edgeColorSet: string;
  visualizeInMapLinks: boolean;
  knowledgeGraph: {
    enabled: boolean;
    modelDownloaded: boolean;
  };
}

export interface SettingsSlice {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadSettingsFromStorage: () => void;
  saveSettingsToStorage: () => void;
}

export interface UISlice extends UIActions {
  ui: UIState;
  setSearchQuery: (query: string) => void;
  setSearchHighlightedNodes: (nodeIds: Set<string>) => void;
  clearSearchHighlight: () => void;
}

export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}


export interface MindMapStore extends HistoryState, SettingsSlice, UISlice {
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  lastSelectionBeforeInsert?: string | null;
  ui: UIState;
  
  
  setData: (data: MindMapData) => void;
  setRootNodes: (rootNodes: MindMapNode[], options?: { emit?: boolean; source?: string; reason?: string }) => void;
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
