import { useEffect } from 'react';
import { useMindMapStore } from '../store';

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
  useEffect(() => {
    const handler = async (e: any) => {
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
    };
    window.addEventListener('mindoodle:selectMapById', handler as EventListener);
    return () => window.removeEventListener('mindoodle:selectMapById', handler as EventListener);
  }, [selectMapById]);

  // Refresh explorer/map list on external changes or when window regains focus
  useEffect(() => {
    const doRefresh = () => {
      try {
        if (typeof (mindMap as any).refreshMapList === 'function') {
          void (mindMap as any).refreshMapList();
        }
      } catch (e) {
        console.error('Explorer refresh failed:', e);
      }
    };
    const onVisibility = () => { if (!document.hidden) doRefresh(); };
    const onFocus = () => doRefresh();
    const onCustom = () => doRefresh();
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('mindoodle:refreshExplorer', onCustom as EventListener);
    const interval = window.setInterval(doRefresh, 7000);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('mindoodle:refreshExplorer', onCustom as EventListener);
      window.clearInterval(interval);
    };
  }, [mindMap]);

  // Handle rename/delete events from explorer
  useEffect(() => {
    const onRename = (e: any) => {
      try {
        const oldPath = e?.detail?.oldPath;
        const newName = e?.detail?.newName;
        if (oldPath && newName && typeof (mindMap as any).renameItem === 'function') {
          void (mindMap as any).renameItem(oldPath, newName).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Rename failed:', err));
        }
      } catch (err) {
        console.error('Rename handler failed:', err);
      }
    };
    const onDelete = (e: any) => {
      try {
        const path = e?.detail?.path;
        if (path && typeof (mindMap as any).deleteItem === 'function') {
          void (mindMap as any).deleteItem(path).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Delete failed:', err));
        }
      } catch (err) {
        console.error('Delete handler failed:', err);
      }
    };
    window.addEventListener('mindoodle:renameItem', onRename as EventListener);
    window.addEventListener('mindoodle:deleteItem', onDelete as EventListener);
    return () => {
      window.removeEventListener('mindoodle:renameItem', onRename as EventListener);
      window.removeEventListener('mindoodle:deleteItem', onDelete as EventListener);
    };
  }, [mindMap]);

  // Handle move events from explorer (drag & drop)
  useEffect(() => {
    const onMove = (e: any) => {
      try {
        const src = e?.detail?.sourcePath;
        const dst = e?.detail?.targetFolderPath ?? '';

        if (src !== undefined && typeof (mindMap as any).moveItem === 'function') {
          void (mindMap as any).moveItem(src, dst).then(() => {
            window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
          }).catch((err: unknown) => console.error('Move failed:', err));
        }
      } catch (err) {
        console.error('Move handler failed:', err);
      }
    };
    window.addEventListener('mindoodle:moveItem', onMove as EventListener);
    return () => window.removeEventListener('mindoodle:moveItem', onMove as EventListener);
  }, [mindMap]);
}
