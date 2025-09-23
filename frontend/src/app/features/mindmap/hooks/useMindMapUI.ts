import { useCallback } from 'react';
import { useMindMapStore } from '../store';
import type { Position } from '@shared/types';

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
    setZoom: useCallback((zoom: number) => {
      setZoom(zoom);
    }, [setZoom]),

    setPan: useCallback((pan: Position | ((prev: Position) => Position)) => {
      if (typeof pan === 'function') {
        storeSetPan(pan(ui.pan));
      } else {
        storeSetPan(pan);
      }
    }, [storeSetPan, ui.pan]),

    resetZoom: useCallback(() => {
      resetZoom();
    }, [resetZoom]),

    // パネル管理

    closeAllPanels: useCallback(() => {
      closeAllPanels();
    }, [closeAllPanels]),

    // サイドバー
    toggleSidebar: useCallback(() => {
      toggleSidebar();
    }, [toggleSidebar]),

    setSidebarCollapsed: useCallback((collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
    }, [setSidebarCollapsed]),

    // ノートパネル
    setShowNotesPanel: useCallback((show: boolean) => {
      setShowNotesPanel(show);
    }, [setShowNotesPanel]),

    toggleNotesPanel: useCallback(() => {
      toggleNotesPanel();
    }, [toggleNotesPanel]),

    hideImageModal: useCallback(() => {
      setShowImageModal(false);
    }, [setShowImageModal]),



    // ファイルアクションメニュー
    showFileActionMenu: useCallback((position: Position) => {
      setFileMenuPosition(position);
      setShowFileActionMenu(true);
    }, [setFileMenuPosition, setShowFileActionMenu]),

    hideFileActionMenu: useCallback(() => {
      setShowFileActionMenu(false);
    }, [setShowFileActionMenu])
  };

  return {
    // UI状態
    ui,
    
    // 操作
    ...uiOperations
  };
};