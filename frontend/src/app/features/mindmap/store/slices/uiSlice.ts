import type { StateCreator } from 'zustand';
import type { Position, MindMapNode } from '@shared/types';
import type { MindMapStore } from './types';
import type { UIState, UIActions } from '@shared/types';

export interface UISlice extends UIActions {
  ui: UIState;
}

export const createUISlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  UISlice
> = (set) => ({
  // Initial UI state
  ui: {
    zoom: 1,
    pan: { x: 0, y: 0 },
    showContextMenu: false,
    contextMenuPosition: { x: 0, y: 0 },
    showShortcutHelper: false,
    showMapList: false,
    sidebarCollapsed: false,
    showLocalStoragePanel: false,
    showTutorial: false,
    showNotesPanel: false,
    fileMenuPosition: { x: 0, y: 0 },
    showImageModal: false,
    showFileActionMenu: false,
    clipboard: null,
    showLinkListForNode: null,
  },

  // Zoom and Pan Actions
  setZoom: (zoom: number) => {
    set((state) => {
      state.ui.zoom = Math.max(0.1, Math.min(3, zoom));
    });
  },

  setPan: (pan: Position) => {
    set((state) => {
      state.ui.pan = pan;
    });
  },

  resetZoom: () => {
    set((state) => {
      state.ui.zoom = 1;
      state.ui.pan = { x: 0, y: 0 };
    });
  },

  // Panel Management Actions

  setShowContextMenu: (show: boolean) => {
    set((state) => {
      state.ui.showContextMenu = show;
    });
  },

  setContextMenuPosition: (position: Position) => {
    set((state) => {
      state.ui.contextMenuPosition = position;
    });
  },

  setShowShortcutHelper: (show: boolean) => {
    set((state) => {
      state.ui.showShortcutHelper = show;
    });
  },

  setShowMapList: (show: boolean) => {
    set((state) => {
      state.ui.showMapList = show;
    });
  },


  setSidebarCollapsed: (collapsed: boolean) => {
    set((state) => {
      state.ui.sidebarCollapsed = collapsed;
    });
  },

  setShowLocalStoragePanel: (show: boolean) => {
    set((state) => {
      state.ui.showLocalStoragePanel = show;
    });
  },

  setShowTutorial: (show: boolean) => {
    set((state) => {
      state.ui.showTutorial = show;
    });
  },

  setShowNotesPanel: (show: boolean) => {
    set((state) => {
      state.ui.showNotesPanel = show;
    });
  },

  toggleNotesPanel: () => {
    set((state) => {
      state.ui.showNotesPanel = !state.ui.showNotesPanel;
    });
  },

  // Outline view removed; related actions deleted

  // File and Image Management Actions

  setFileMenuPosition: (position: Position) => {
    set((state) => {
      state.ui.fileMenuPosition = position;
    });
  },

  setShowImageModal: (show: boolean) => {
    set((state) => {
      state.ui.showImageModal = show;
    });
  },

  setShowFileActionMenu: (show: boolean) => {
    set((state) => {
      state.ui.showFileActionMenu = show;
    });
  },

  // Other UI State Actions
  setClipboard: (node: MindMapNode | null) => {
    set((state) => {
      state.ui.clipboard = node;
    });
  },

  setShowLinkListForNode: (nodeId: string | null) => {
    set((state) => {
      state.ui.showLinkListForNode = nodeId;
    });
  },

  toggleLinkListForNode: (nodeId: string) => {
    set((state) => {
      state.ui.showLinkListForNode =
        state.ui.showLinkListForNode === nodeId ? null : nodeId;
    });
  },

  closeAttachmentAndLinkLists: () => {
    set((state) => {
      state.ui.showLinkListForNode = null;
    });
  },

  // Composite Actions
  closeAllPanels: () => {
    set((state) => {
      state.ui.showContextMenu = false;
      state.ui.showShortcutHelper = false;
      state.ui.showMapList = false;
      state.ui.showLocalStoragePanel = false;
      state.ui.showImageModal = false;
      state.ui.showFileActionMenu = false;
      state.ui.showTutorial = false;
      state.ui.showLinkListForNode = null;
      // Note: showNotesPanel は意図的に closeAllPanels から除外
    });
  },

  toggleSidebar: () => {
    set((state) => {
      state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
    });
  },


});
