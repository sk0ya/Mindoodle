import { useEffect, useRef } from 'react';
import { useStableCallback } from '@shared/hooks';
import { getRootNodes } from './useStoreSelectors';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { logger, statusMessages } from '@shared/utils';
import type { RefreshMapListOptions } from './useMindMapPersistence';

/**
 * How often the map list is polled while the tab is visible. Local folders
 * are re-read on every tick (external edits); remote workspaces are reached
 * at most every REMOTE_BACKGROUND_REFRESH_MS (see useMindMapPersistence).
 */
export const MAP_LIST_POLL_INTERVAL_MS = 7000;

/** Showing the tab again refreshes at most once within this window. */
export const RETURN_REFRESH_MIN_GAP_MS = 5000;

const errorMessage = (err: unknown): string => (err instanceof Error && err.message ? err.message : String(err));

interface UseMindMapEventsParams {
  mindMap: {
    refreshMapList?: (options?: RefreshMapListOptions) => Promise<void> | void;
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

  const refresh = useStableCallback((options?: RefreshMapListOptions) => {
    try {
      const r = mindMap.refreshMapList?.(options);
      if (r && typeof r.then === 'function') {
        r.catch((err: unknown) => logger.warn('Refresh list failed:', err));
      }
    } catch (e) {
      logger.error('Explorer refresh failed:', e);
    }
  });

  const lastReturnRefreshRef = useRef(0);

  // The tab was hidden, so polls were skipped: catch up now. Revealing a tab
  // can fire several events in a row; refresh once for all of them.
  const onVisibility = useStableCallback(() => {
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastReturnRefreshRef.current < RETURN_REFRESH_MIN_GAP_MS) return;
    lastReturnRefreshRef.current = now;
    refresh();
  });

  // Window focus also fires when switching between two visible windows, so it
  // only nudges a background refresh (cheap, and rate-limited for remote
  // workspaces) rather than forcing a fetch.
  const onFocus = useStableCallback(() => {
    if (!document.hidden) refresh({ background: true });
  });

  const onRefreshExplorer = useStableCallback(() => refresh());

  const onPollTick = useStableCallback(() => {
    if (!document.hidden) refresh({ background: true });
  });

  useEventListener('visibilitychange', onVisibility, { target: document });
  useEventListener('focus', onFocus, { target: window });
  useEventListener('mindoodle:refreshExplorer', onRefreshExplorer, { target: window });

  useEffect(() => {
    const interval = window.setInterval(onPollTick, MAP_LIST_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [onPollTick]);

  const onRename = useStableCallback((e: Event) => {
    const evt = e as CustomEvent;
    const oldPath = evt?.detail?.oldPath;
    const newName = evt?.detail?.newName;
    if (oldPath && newName && typeof (mindMap).renameItem === 'function') {
      // renameItem refreshes the list itself; dispatching another refresh
      // here only repeated the same requests.
      (mindMap).renameItem(oldPath, newName)
        .catch((err: unknown) => {
          logger.error('Rename failed:', err);
          statusMessages.customError(`名前の変更に失敗しました: ${errorMessage(err)}`);
        });
    }
  });

  const onDelete = useStableCallback((e: Event) => {
    const evt = e as CustomEvent;
    const path = evt?.detail?.path;
    if (path && typeof (mindMap).deleteItem === 'function') {
      (mindMap).deleteItem(path)
        .catch((err: unknown) => {
          logger.error('Delete failed:', err);
          statusMessages.customError(`削除に失敗しました: ${errorMessage(err)}`);
        });
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
        .catch((err: unknown) => {
          logger.error('Move failed:', err);
          statusMessages.customError(`移動に失敗しました: ${errorMessage(err)}`);
        });
    }
  });

  useEventListener('mindoodle:moveItem', onMove, { target: window });
}
