import { useEffect } from 'react';
import { useStableCallback } from '@shared/hooks';
import { useMindMapStore } from '../store';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface UseMindMapEventsParams {
  mindMap: any;
  selectMapById: (id: any) => Promise<boolean>;
}

/**
 * MindMapApp event handlers hook
 * Handles explorer selection, refresh, rename, delete, and move events
 */
export function useMindMapEvents({ mindMap, selectMapById }: UseMindMapEventsParams) {
  // Listen to explorer selection events
  const handleSelectMapById = useStableCallback(async (e: any) => {
    const id = e?.detail?.mapId as string | undefined;
    const ws = e?.detail?.workspaceId as string;
    const source = e?.detail?.source as string | undefined;
    const direction = e?.detail?.direction as ('prev' | 'next' | undefined);
    if (!id || typeof selectMapById !== 'function') return;

    const ordered: Array<{ mapId: string; workspaceId: string }> = (window as any).mindoodleOrderedMaps || [];
    const dirStep = direction === 'prev' ? -1 : 1;

    const trySelect = async (mapId: string, workspaceId: string): Promise<boolean> => {
      const ok = await selectMapById({ mapId, workspaceId: workspaceId as any });
      if (!ok) return false;
      // Allow state to settle
      await Promise.resolve();
      const current = useMindMapStore.getState().data;
      const roots = current?.rootNodes || [];
      const empty = !Array.isArray(roots) || roots.length === 0 || (roots.length === 1 && (!roots[0].children || roots[0].children.length === 0));
      return !empty;
    };

    if (source === 'keyboard' && (direction === 'prev' || direction === 'next') && Array.isArray(ordered) && ordered.length > 0) {
      // Start from requested id and skip empties following the direction
      let idx = ordered.findIndex(o => o.mapId === id);
      if (idx < 0) idx = 0;
      for (let step = 0; step < ordered.length; step++) {
        const i = (idx + (dirStep * step) + ordered.length) % ordered.length;
        const cand = ordered[i];
        const ok = await trySelect(cand.mapId, cand.workspaceId);
        if (ok) break;
      }
    } else {
      // Default behavior
      await selectMapById({ mapId: id, workspaceId: ws });
    }
  });

  useEventListener('mindoodle:selectMapById' as any, handleSelectMapById as any, { target: window });

  // Refresh explorer/map list on external changes or when window regains focus
  const doRefresh = useStableCallback(() => {
    try {
      if (typeof (mindMap).refreshMapList === 'function') {
        void (mindMap).refreshMapList();
      }
    } catch (e) {
      console.error('Explorer refresh failed:', e);
    }
  });

  const onVisibility = useStableCallback(() => {
    if (!document.hidden) doRefresh();
  });

  const onFocus = useStableCallback(() => doRefresh());

  useEventListener('visibilitychange', onVisibility, { target: document });
  useEventListener('focus', onFocus, { target: window });
  useEventListener('mindoodle:refreshExplorer' as any, doRefresh as any, { target: window });

  useEffect(() => {
    const interval = window.setInterval(doRefresh, 7000);
    return () => window.clearInterval(interval);
  }, [doRefresh]);

  // Handle rename/delete events from explorer
  const onRename = useStableCallback((e: any) => {
    try {
      const oldPath = e?.detail?.oldPath;
      const newName = e?.detail?.newName;
      if (oldPath && newName && typeof (mindMap).renameItem === 'function') {
        void (mindMap).renameItem(oldPath, newName).then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        }).catch((err: unknown) => console.error('Rename failed:', err));
      }
    } catch (err) {
      console.error('Rename handler failed:', err);
    }
  });

  const onDelete = useStableCallback((e: any) => {
    try {
      const path = e?.detail?.path;
      if (path && typeof (mindMap).deleteItem === 'function') {
        void (mindMap).deleteItem(path).then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        }).catch((err: unknown) => console.error('Delete failed:', err));
      }
    } catch (err) {
      console.error('Delete handler failed:', err);
    }
  });

  useEventListener('mindoodle:renameItem' as any, onRename as any, { target: window });
  useEventListener('mindoodle:deleteItem' as any, onDelete as any, { target: window });

  // Handle move events from explorer (drag & drop)
  const onMove = useStableCallback((e: any) => {
    try {
      const src = e?.detail?.sourcePath;
      const dst = e?.detail?.targetFolderPath ?? '';

      if (src !== undefined && typeof (mindMap).moveItem === 'function') {
        void (mindMap).moveItem(src, dst).then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        }).catch((err: unknown) => console.error('Move failed:', err));
      }
    } catch (err) {
      console.error('Move handler failed:', err);
    }
  });

  useEventListener('mindoodle:moveItem' as any, onMove as any, { target: window });
}
