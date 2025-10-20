import { useUI, useViewport, useUIOperations } from './useStoreSelectors';
import type { Position } from '@shared/types';
import { useStableCallback } from '@shared/hooks';


export const useMindMapUI = () => {
  const ui = useUI();
  const { setZoom, setPan: storeSetPan } = useViewport();
  const {
    resetZoom,
    closeAllPanels,
    toggleSidebar,
    setSidebarCollapsed,
    setShowNotesPanel,
    toggleNotesPanel,
    setShowImageModal,
    setFileMenuPosition,
    setShowFileActionMenu,
  } = useUIOperations();

  const uiOperations = {
    
    setZoom: useStableCallback((zoom: number) => {
      setZoom(zoom);
    }),

    setPan: useStableCallback((pan: Position | ((prev: Position) => Position)) => {
      if (typeof pan === 'function') {
        storeSetPan(pan(ui.pan));
      } else {
        storeSetPan(pan);
      }
    }),

    resetZoom: useStableCallback(() => {
      resetZoom();
    }),

    

    closeAllPanels: useStableCallback(() => {
      closeAllPanels();
    }),

    
    toggleSidebar: useStableCallback(() => {
      toggleSidebar();
    }),

    setSidebarCollapsed: useStableCallback((collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
    }),

    
    setShowNotesPanel: useStableCallback((show: boolean) => {
      setShowNotesPanel(show);
    }),

    toggleNotesPanel: useStableCallback(() => {
      toggleNotesPanel();
    }),

    hideImageModal: useStableCallback(() => {
      setShowImageModal(false);
    }),



    
    showFileActionMenu: useStableCallback((position: Position) => {
      setFileMenuPosition(position);
      setShowFileActionMenu(true);
    }),

    hideFileActionMenu: useStableCallback(() => {
      setShowFileActionMenu(false);
    })
  };

  return {
    
    ui,
    
    
    ...uiOperations
  };
};