import { useEffect } from 'react';
import { useStableCallback } from '@shared/hooks';
import { getRootNodes } from './useStoreSelectors';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { logger } from '@shared/utils';

interface UseMindMapEventsParams {
  mindMap: {
    refreshMapList?: () => Promise<void> | void;
    renameItem?: (oldPath: string, newName: string) => Promise<void>;
    deleteItem?: (path: string) => Promise<void>;
    moveItem?: (sourcePath: string, targetFolderPath: string, workspaceId?: string | null) => Promise<void>;
  };
  selectMapById: (id: { mapId: string; workspaceId: string }) => Promise<boolean>;
}


export function useMindMapEvents({ mindMap, selectMapById }: UseMindMapEventsParams) {
  
  const handleSelectMapById = useStableCallback(async (e: Event) => {
    const evt = e as CustomEvent;
    const id = evt?.detail?.mapId as string | undefined;
    const ws = evt?.detail?.workspaceId as string;
    const source = evt?.detail?.source as string | undefined;
    const direction = evt?.detail?.direction as ('prev' | 'next' | undefined);
    if (!id || typeof selectMapById !== 'function') return;

    const ordered: Array<{ mapId: string; workspaceId: string }> = (window as Window & { mindoodleOrderedMaps?: Array<{ mapId: string; workspaceId: string }> }).mindoodleOrderedMaps || [];
    const dirStep = direction === 'prev' ? -1 : 1;

    const trySelect = async (mapId: string, workspaceId: string): Promise<boolean> => {
      const ok = await selectMapById({ mapId, workspaceId });
      if (!ok) return false;

      await Promise.resolve();
      const roots = getRootNodes();
      const empty = !Array.isArray(roots) || roots.length === 0 || (roots.length === 1 && (!roots[0].children || roots[0].children.length === 0));
      return !empty;
    };

    if (source === 'keyboard' && (direction === 'prev' || direction === 'next') && Array.isArray(ordered) && ordered.length > 0) {
      
      let idx = ordered.findIndex(o => o.mapId === id);
      if (idx < 0) idx = 0;
      for (let step = 0; step < ordered.length; step++) {
        const i = (idx + (dirStep * step) + ordered.length) % ordered.length;
        const cand = ordered[i];
        const ok = await trySelect(cand.mapId, cand.workspaceId);
        if (ok) break;
      }
    } else {
      
      await selectMapById({ mapId: id, workspaceId: ws });
    }
  });

  useEventListener('mindoodle:selectMapById', handleSelectMapById, { target: window });

  
  const doRefresh = useStableCallback(() => {
    try {
      if (typeof (mindMap).refreshMapList === 'function') {
        const r = (mindMap).refreshMapList();
        if (r && typeof (r).then === 'function') {
          (r as Promise<unknown>).catch((err) => logger.warn('Refresh list failed:', err));
        }
      }
    } catch (e) {
      logger.error('Explorer refresh failed:', e);
    }
  });

  const onVisibility = useStableCallback(() => {
    if (!document.hidden) doRefresh();
  });

  const onFocus = useStableCallback(() => doRefresh());

  useEventListener('visibilitychange', onVisibility, { target: document });
  useEventListener('focus', onFocus, { target: window });
  useEventListener('mindoodle:refreshExplorer', doRefresh, { target: window });

  useEffect(() => {
    const interval = window.setInterval(doRefresh, 7000);
    return () => window.clearInterval(interval);
  }, [doRefresh]);

  
  const onRename = useStableCallback((e: Event) => {
    const evt = e as CustomEvent;
    const oldPath = evt?.detail?.oldPath;
    const newName = evt?.detail?.newName;
    if (oldPath && newName && typeof (mindMap).renameItem === 'function') {
      (mindMap).renameItem(oldPath, newName)
        .then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        })
        .catch((err: unknown) => logger.error('Rename failed:', err));
    }
  });

  const onDelete = useStableCallback((e: Event) => {
    const evt = e as CustomEvent;
    const path = evt?.detail?.path;
    if (path && typeof (mindMap).deleteItem === 'function') {
      (mindMap).deleteItem(path)
        .then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        })
        .catch((err: unknown) => logger.error('Delete failed:', err));
    }
  });

  useEventListener('mindoodle:renameItem', onRename, { target: window });
  useEventListener('mindoodle:deleteItem', onDelete, { target: window });

  
  const onMove = useStableCallback((e: Event) => {
    const evt = e as CustomEvent;
    const src = evt?.detail?.sourcePath;
    const dst = evt?.detail?.targetFolderPath ?? '';
    const ws = evt?.detail?.workspaceId as (string | undefined);
    if (src !== undefined && typeof (mindMap).moveItem === 'function') {
      (mindMap).moveItem(src, dst, ws)
        .then(() => {
          window.dispatchEvent(new CustomEvent('mindoodle:refreshExplorer'));
        })
        .catch((err: unknown) => logger.error('Move failed:', err));
    }
  });

  useEventListener('mindoodle:moveItem', onMove, { target: window });
}
