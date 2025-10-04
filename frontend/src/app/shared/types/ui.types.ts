/**
 * UI Types - UI状態とインタラクションの型定義
 */

import type { Position } from './base.types';
import type { MindMapNode } from './data.types';

// UI状態
export interface UIState {
  // Basic UI state
  zoom: number;
  pan: Position;

  // Panel visibility
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

  // Overlay dimensions (virtual state, not DOM queries)
  markdownPanelWidth?: number; // right panel width in px
  nodeNotePanelHeight?: number; // bottom note panel height in px

  // File and image states
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;

  // Other UI states
  clipboard: MindMapNode | null;

  // Icon-triggered displays
  showLinkListForNode: string | null;

  // Search highlighting
  searchHighlightedNodes: Set<string>;
  searchQuery: string;

  // Mermaid cache management
  lastMermaidCacheCleared?: number;
}

// Context menu state
export interface ContextMenuState {
  visible: boolean;
  position: Position;
  nodeId: string | null;
}

// Modal states
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

// UI Actions interface
export interface UIActions {
  // Zoom and Pan
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;

  // Panel Management
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

  // Overlay dimension setters
  setMarkdownPanelWidth?: (width: number) => void;
  setNodeNotePanelHeight?: (height: number) => void;

  // File and Image Management
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;

  // Other UI States
  setClipboard: (node: MindMapNode | null) => void;

  // Icon-triggered displays
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  closeAttachmentAndLinkLists: () => void;

  // Search highlighting
  setSearchQuery: (query: string) => void;
  setSearchHighlightedNodes: (nodeIds: Set<string>) => void;
  clearSearchHighlight: () => void;

  // Composite Actions
  closeAllPanels: () => void;
  toggleSidebar: () => void;
}

// Combined UI interface
export interface UISlice extends UIActions {
  ui: UIState;
}
