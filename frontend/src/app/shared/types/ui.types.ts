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
  showCustomizationPanel: boolean;
  customizationPosition: Position;
  showContextMenu: boolean;
  contextMenuPosition: Position;
  showShortcutHelper: boolean;
  showMapList: boolean;
  sidebarCollapsed: boolean;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  showNotesPanel: boolean;

  // File and image states
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;

  // Other UI states
  clipboard: MindMapNode | null;

  // Icon-triggered displays
  showAttachmentListForNode: string | null;
  showLinkListForNode: string | null;
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
  showCustomizationPanel: boolean;
  showContextMenu: boolean;
}

// UI Actions interface
export interface UIActions {
  // Zoom and Pan
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;

  // Panel Management
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

  // File and Image Management
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;

  // Other UI States
  setClipboard: (node: MindMapNode | null) => void;

  // Icon-triggered displays
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  // Composite Actions
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
}

// Combined UI interface
export interface UISlice extends UIActions {
  ui: UIState;
}