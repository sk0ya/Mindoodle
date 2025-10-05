import type { StateCreator } from 'zustand';
import type { Position, MindMapNode } from '@shared/types';
import type { UIMode, PanelId } from '@shared/types';
import type { MindMapStore } from './types';
import { nextMode } from '@mindmap/state/uiModeMachine';
import * as panelManager from '@mindmap/state/panelManager';
import type { UIState, UIActions } from '@shared/types';

export interface UISlice extends UIActions {
  ui: UIState;
  // Search highlighting actions
  setSearchQuery: (query: string) => void;
  setSearchHighlightedNodes: (nodeIds: Set<string>) => void;
  clearSearchHighlight: () => void;
}

export const createUISlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  UISlice
> = (set) => ({
  // Initial UI state
  ui: {
    mode: 'normal' as UIMode,
    zoom: 1,
    pan: { x: 0, y: 0 },
    showContextMenu: false,
    contextMenuPosition: { x: 0, y: 0 },
    showShortcutHelper: false,
    showMapList: false,
    sidebarCollapsed: false,
    activeView: 'maps' as string | null,
    showLocalStoragePanel: false,
    showTutorial: false,
    showNotesPanel: false,
    showNodeNotePanel: false,
    showVimSettingsPanel: false,
    markdownPanelWidth: 0,
    nodeNotePanelHeight: 0,
    fileMenuPosition: { x: 0, y: 0 },
    showImageModal: false,
    showFileActionMenu: false,
    clipboard: null,
    showLinkListForNode: null,
    searchHighlightedNodes: new Set<string>(),
    searchQuery: '',
    openPanels: {},
  },

  // Mode management
  setMode: (mode: UIMode) => {
    set((state) => {
      const current = (state.ui.mode ?? 'normal');
      state.ui.mode = nextMode(current, mode);
    });
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

  setActiveView: (view: string | null) => {
    set((state) => {
      state.ui.activeView = view;
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

  setShowNodeNotePanel: (show: boolean) => {
    set((state) => {
      state.ui.showNodeNotePanel = show;
    });
  },

  // Vim Settings Panel
  setShowVimSettingsPanel: (show: boolean) => {
    set((state) => {
      (state.ui as any).showVimSettingsPanel = show;
    });
  },

  toggleVimSettingsPanel: () => {
    set((state) => {
      (state.ui as any).showVimSettingsPanel = !(state.ui as any).showVimSettingsPanel;
    });
  },

  toggleNodeNotePanel: () => {
    set((state) => {
      state.ui.showNodeNotePanel = !state.ui.showNodeNotePanel;
    });
  },

  // Overlay dimension setters
  setMarkdownPanelWidth: (width: number) => {
    set((state) => {
      state.ui.markdownPanelWidth = Math.max(0, Math.floor(width));
    });
  },

  setNodeNotePanelHeight: (height: number) => {
    set((state) => {
      state.ui.nodeNotePanelHeight = Math.max(0, Math.floor(height));
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

  // Search highlighting actions
  setSearchQuery: (query: string) => {
    set((state) => {
      state.ui.searchQuery = query;
    });
  },

  setSearchHighlightedNodes: (nodeIds: Set<string>) => {
    set((state) => {
      state.ui.searchHighlightedNodes = new Set(nodeIds);
    });
  },

  clearSearchHighlight: () => {
    set((state) => {
      state.ui.searchHighlightedNodes = new Set();
      state.ui.searchQuery = '';
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
      (state.ui as any).showVimSettingsPanel = false;
      // Managed panels reset
      state.ui.openPanels = {};
      // Note: showNotesPanel は意図的に closeAllPanels から除外
      // Note: showNodeNotePanel も除外（ユーザーが明示的に閉じる）
    });
  },

  toggleSidebar: () => {
    set((state) => {
      state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
    });
  },

  // Centralized panel manager helpers (optional)
  openPanel: (id: PanelId) => {
    set((state) => {
      // Example exclusivity: contextMenu should not open when linkList is open
      const opts = id === 'contextMenu' ? { exclusiveWith: ['linkList'] as PanelId[] } : {};
      state.ui.openPanels = panelManager.applyOpen(state.ui.openPanels, id, opts);

      // Reflect to legacy booleans for compatibility
      switch (id) {
        case 'contextMenu': state.ui.showContextMenu = panelManager.isOpen(state.ui.openPanels, id); break;
        case 'shortcutHelper': state.ui.showShortcutHelper = true; break;
        case 'mapList': state.ui.showMapList = true; break;
        case 'localStorage': state.ui.showLocalStoragePanel = true; break;
        case 'tutorial': state.ui.showTutorial = true; break;
        case 'notes': state.ui.showNotesPanel = true; break;
        case 'nodeNote': state.ui.showNodeNotePanel = true; break;
        case 'vimSettings': (state.ui as any).showVimSettingsPanel = true; break;
        case 'imageModal': state.ui.showImageModal = true; break;
        case 'fileActionMenu': state.ui.showFileActionMenu = true; break;
        case 'linkList': /* nodeId 管理は別API */ break;
      }
    });
  },
  closePanel: (id: PanelId) => {
    set((state) => {
      state.ui.openPanels = panelManager.applyClose(state.ui.openPanels, id);
      switch (id) {
        case 'contextMenu': state.ui.showContextMenu = false; break;
        case 'shortcutHelper': state.ui.showShortcutHelper = false; break;
        case 'mapList': state.ui.showMapList = false; break;
        case 'localStorage': state.ui.showLocalStoragePanel = false; break;
        case 'tutorial': state.ui.showTutorial = false; break;
        case 'notes': state.ui.showNotesPanel = false; break;
        case 'nodeNote': state.ui.showNodeNotePanel = false; break;
        case 'vimSettings': (state.ui as any).showVimSettingsPanel = false; break;
        case 'imageModal': state.ui.showImageModal = false; break;
        case 'fileActionMenu': state.ui.showFileActionMenu = false; break;
        case 'linkList': state.ui.showLinkListForNode = null; break;
      }
    });
  },
  togglePanel: (id: PanelId) => {
    set((state) => {
      const opts = id === 'contextMenu' ? { exclusiveWith: ['linkList'] as PanelId[] } : {};
      state.ui.openPanels = panelManager.applyToggle(state.ui.openPanels, id, opts);

      const nowOpen = panelManager.isOpen(state.ui.openPanels, id);
      switch (id) {
        case 'contextMenu': state.ui.showContextMenu = nowOpen; break;
        case 'shortcutHelper': state.ui.showShortcutHelper = nowOpen; break;
        case 'mapList': state.ui.showMapList = nowOpen; break;
        case 'localStorage': state.ui.showLocalStoragePanel = nowOpen; break;
        case 'tutorial': state.ui.showTutorial = nowOpen; break;
        case 'notes': state.ui.showNotesPanel = nowOpen; break;
        case 'nodeNote': state.ui.showNodeNotePanel = nowOpen; break;
        case 'vimSettings': (state.ui as any).showVimSettingsPanel = nowOpen; break;
        case 'imageModal': state.ui.showImageModal = nowOpen; break;
        case 'fileActionMenu': state.ui.showFileActionMenu = nowOpen; break;
        case 'linkList': if (!nowOpen) state.ui.showLinkListForNode = null; break;
      }
    });
  },
  closeAllPanelsManaged: () => {
    set((state) => {
      state.ui.openPanels = panelManager.closeAll();
      state.ui.showContextMenu = false;
      state.ui.showShortcutHelper = false;
      state.ui.showMapList = false;
      state.ui.showLocalStoragePanel = false;
      state.ui.showImageModal = false;
      state.ui.showFileActionMenu = false;
      state.ui.showTutorial = false;
      state.ui.showLinkListForNode = null;
      (state.ui as any).showVimSettingsPanel = false;
    });
  },

});
