

import type { Position } from './base.types';
import type { MindMapNode } from './data.types';


export type UIMode = 'normal' | 'insert' | 'visual' | 'menu';


export type PanelId =
  | 'contextMenu'
  | 'shortcutHelper'
  | 'mapList'
  | 'localStorage'
  | 'tutorial'
  | 'notes'
  | 'nodeNote'
  | 'vimSettings'
  | 'imageModal'
  | 'fileActionMenu'
  | 'linkList';


export interface UIState {
  
  mode?: UIMode;

  
  zoom: number;
  pan: Position;

  
  showContextMenu: boolean;
  contextMenuPosition: Position;
  showShortcutHelper: boolean;
  showMapList: boolean;
  sidebarCollapsed: boolean;
  activeView: string | null;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  showNotesPanel: boolean;
  showNodeNotePanel?: boolean;
  showVimSettingsPanel?: boolean;
  showKnowledgeGraph?: boolean;

  
  markdownPanelWidth?: number; 
  nodeNotePanelHeight?: number; 

  
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;

  
  clipboard: MindMapNode | null;

  
  showLinkListForNode: string | null;

  
  searchHighlightedNodes: Set<string>;
  searchQuery: string;

  
  lastMermaidCacheCleared?: number;

  
  openPanels?: Partial<Record<PanelId, boolean>>;
}


export interface ContextMenuState {
  visible: boolean;
  position: Position;
  nodeId: string | null;
}


export interface ModalStates {
  showExportModal: boolean;
  showImportModal: boolean;
  showLoginModal: boolean;
  showLinkModal: boolean;
  showLinkActionMenu: boolean;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  showContextMenu: boolean;
}


export interface UIActions {
  
  setMode?: (mode: UIMode) => void;

  
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;

  
  setShowContextMenu: (show: boolean) => void;
  setContextMenuPosition: (position: Position) => void;
  setShowShortcutHelper: (show: boolean) => void;
  setShowMapList: (show: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveView: (view: string | null) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setShowNotesPanel: (show: boolean) => void;
  toggleNotesPanel: () => void;
  setShowNodeNotePanel?: (show: boolean) => void;
  toggleNodeNotePanel?: () => void;
  setShowVimSettingsPanel?: (show: boolean) => void;
  toggleVimSettingsPanel?: () => void;

  
  setMarkdownPanelWidth?: (width: number) => void;
  setNodeNotePanelHeight?: (height: number) => void;

  
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;

  
  setClipboard: (node: MindMapNode | null) => void;

  
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  closeAttachmentAndLinkLists: () => void;

  
  setSearchQuery: (query: string) => void;
  setSearchHighlightedNodes: (nodeIds: Set<string>) => void;
  clearSearchHighlight: () => void;

  
  closeAllPanels: () => void;
  toggleSidebar: () => void;

  
  openPanel?: (id: PanelId) => void;
  closePanel?: (id: PanelId) => void;
  togglePanel?: (id: PanelId) => void;
  closeAllPanelsManaged?: () => void;
}


export interface UISlice extends UIActions {
  ui: UIState;
}
