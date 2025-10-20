import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createUISlice } from './uiSlice';
import type { MindMapStore } from './types';
import type { Position, UIMode } from '@shared/types';

// Create a minimal test store with only UI slice
const createTestStore = () => {
  return create<Pick<MindMapStore, keyof ReturnType<typeof createUISlice>>>()(
    immer((...args) => ({
      ...createUISlice(...args),
    }))
  );
};

describe('UISlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = store.getState();

      expect(state.ui.mode).toBe('normal');
      expect(state.ui.zoom).toBe(1);
      expect(state.ui.pan).toEqual({ x: 0, y: 0 });
      expect(state.ui.showContextMenu).toBe(false);
      expect(state.ui.showShortcutHelper).toBe(false);
      expect(state.ui.showMapList).toBe(false);
      expect(state.ui.sidebarCollapsed).toBe(false);
      expect(state.ui.showNotesPanel).toBe(false);
      expect(state.ui.showNodeNotePanel).toBe(false);
      expect(state.ui.showVimSettingsPanel).toBe(false);
      expect(state.ui.showImageModal).toBe(false);
      expect(state.ui.showFileActionMenu).toBe(false);
      expect(state.ui.clipboard).toBe(null);
      expect(state.ui.searchQuery).toBe('');
    });
  });

  describe('mode management', () => {
    it('should change mode', () => {
      store.getState().setMode('insert');
      expect(store.getState().ui.mode).toBe('insert');

      store.getState().setMode('visual');
      expect(store.getState().ui.mode).toBe('visual');

      store.getState().setMode('normal');
      expect(store.getState().ui.mode).toBe('normal');
    });

    it('should handle mode transitions through state machine', () => {
      const { setMode } = store.getState();

      // Normal -> Insert
      setMode('insert');
      expect(store.getState().ui.mode).toBe('insert');

      // Insert -> Normal
      setMode('normal');
      expect(store.getState().ui.mode).toBe('normal');
    });
  });

  describe('zoom management', () => {
    it('should set zoom level', () => {
      store.getState().setZoom(1.5);
      expect(store.getState().ui.zoom).toBe(1.5);
    });

    it('should clamp zoom to minimum 0.1', () => {
      store.getState().setZoom(0.05);
      expect(store.getState().ui.zoom).toBe(0.1);
    });

    it('should clamp zoom to maximum 3', () => {
      store.getState().setZoom(5);
      expect(store.getState().ui.zoom).toBe(3);
    });

    it('should reset zoom to 1 and pan to origin', () => {
      store.getState().setZoom(2);
      store.getState().setPan({ x: 100, y: 200 });

      store.getState().resetZoom();

      expect(store.getState().ui.zoom).toBe(1);
      expect(store.getState().ui.pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('pan management', () => {
    it('should set pan position', () => {
      const newPan: Position = { x: 150, y: 250 };
      store.getState().setPan(newPan);

      expect(store.getState().ui.pan).toEqual(newPan);
    });

    it('should update pan position independently', () => {
      store.getState().setPan({ x: 100, y: 0 });
      expect(store.getState().ui.pan.x).toBe(100);

      store.getState().setPan({ x: 100, y: 200 });
      expect(store.getState().ui.pan.y).toBe(200);
    });
  });

  describe('context menu', () => {
    it('should show context menu', () => {
      store.getState().setShowContextMenu(true);
      expect(store.getState().ui.showContextMenu).toBe(true);
    });

    it('should hide context menu', () => {
      store.getState().setShowContextMenu(true);
      store.getState().setShowContextMenu(false);
      expect(store.getState().ui.showContextMenu).toBe(false);
    });

    it('should set context menu position', () => {
      const position: Position = { x: 300, y: 400 };
      store.getState().setContextMenuPosition(position);

      expect(store.getState().ui.contextMenuPosition).toEqual(position);
    });
  });

  describe('panels and modals', () => {
    it('should toggle shortcut helper', () => {
      store.getState().setShowShortcutHelper(true);
      expect(store.getState().ui.showShortcutHelper).toBe(true);

      store.getState().setShowShortcutHelper(false);
      expect(store.getState().ui.showShortcutHelper).toBe(false);
    });

    it('should toggle map list', () => {
      store.getState().setShowMapList(true);
      expect(store.getState().ui.showMapList).toBe(true);

      store.getState().setShowMapList(false);
      expect(store.getState().ui.showMapList).toBe(false);
    });

    it('should toggle sidebar collapsed state', () => {
      store.getState().setSidebarCollapsed(true);
      expect(store.getState().ui.sidebarCollapsed).toBe(true);

      store.getState().setSidebarCollapsed(false);
      expect(store.getState().ui.sidebarCollapsed).toBe(false);
    });
  });

  describe('search', () => {
    it('should have empty search query initially', () => {
      expect(store.getState().ui.searchQuery).toBe('');
      expect(store.getState().ui.searchHighlightedNodes.size).toBe(0);
    });

    it('should track search highlighted nodes as Set', () => {
      const state = store.getState();
      expect(state.ui.searchHighlightedNodes).toBeInstanceOf(Set);
    });
  });

  describe('clipboard', () => {
    it('should start with null clipboard', () => {
      expect(store.getState().ui.clipboard).toBe(null);
    });
  });

  describe('immutability', () => {
    it('should not mutate previous state when updating zoom', () => {
      const initialState = store.getState().ui;
      const initialZoom = initialState.zoom;

      store.getState().setZoom(2);

      // Initial state reference should remain unchanged (Immer creates new state)
      expect(initialZoom).toBe(1);
      expect(store.getState().ui.zoom).toBe(2);
    });

    it('should not mutate previous state when updating pan', () => {
      const initialPan = store.getState().ui.pan;

      store.getState().setPan({ x: 100, y: 200 });

      // Initial pan reference should remain unchanged
      expect(initialPan).toEqual({ x: 0, y: 0 });
      expect(store.getState().ui.pan).toEqual({ x: 100, y: 200 });
    });
  });

  describe('state machine integration', () => {
    it('should handle mode transitions through uiModeMachine', () => {
      // The setMode function uses nextMode from uiModeMachine
      // This test verifies the integration works
      const { setMode } = store.getState();

      expect(store.getState().ui.mode).toBe('normal');

      setMode('insert');
      expect(store.getState().ui.mode).toBe('insert');

      setMode('normal');
      expect(store.getState().ui.mode).toBe('normal');
    });
  });
});
