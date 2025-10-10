import { useMindMapStore } from '../store';
import type { Position } from '@shared/types';
import { useStableCallback } from '@shared/hooks';

/**
 * UI状態管理に特化したHook
 * パネル、モーダル、ビューポート等のUI制御を担当
 */
export const useMindMapUI = () => {
  const {
    setZoom,
    setPan: storeSetPan,
    resetZoom,
    closeAllPanels,
    toggleSidebar,
    setSidebarCollapsed,
    setShowNotesPanel,
    toggleNotesPanel,
    setShowImageModal,
    setFileMenuPosition,
    setShowFileActionMenu,
    ui
  } = useMindMapStore();

  const uiOperations = {
    // ズームとパン
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

    // パネル管理

    closeAllPanels: useStableCallback(() => {
      closeAllPanels();
    }),

    // サイドバー
    toggleSidebar: useStableCallback(() => {
      toggleSidebar();
    }),

    setSidebarCollapsed: useStableCallback((collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
    }),

    // ノートパネル
    setShowNotesPanel: useStableCallback((show: boolean) => {
      setShowNotesPanel(show);
    }),

    toggleNotesPanel: useStableCallback(() => {
      toggleNotesPanel();
    }),

    hideImageModal: useStableCallback(() => {
      setShowImageModal(false);
    }),



    // ファイルアクションメニュー
    showFileActionMenu: useStableCallback((position: Position) => {
      setFileMenuPosition(position);
      setShowFileActionMenu(true);
    }),

    hideFileActionMenu: useStableCallback(() => {
      setShowFileActionMenu(false);
    })
  };

  return {
    // UI状態
    ui,
    
    // 操作
    ...uiOperations
  };
};