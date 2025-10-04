import { useEffect } from 'react';
import type { MapIdentifier } from '@shared/types';

interface WindowGlobalsBridgeParams {
  workspaces: any[] | undefined;
  addWorkspace: (() => Promise<void>) | undefined;
  removeWorkspace: ((id: string) => Promise<void>) | undefined;
  allMindMaps: any[] | undefined;
  currentMapId: string | null;
  explorerTree: any;
  selectMapById: (mapId: MapIdentifier) => Promise<void>;
  mindMap: any;
}

/**
 * Hook to bridge workspace and map data to window globals for keyboard shortcuts
 * This is a temporary solution for quick wiring with keyboard shortcuts
 */
export function useWindowGlobalsBridge({
  workspaces,
  addWorkspace,
  removeWorkspace,
  allMindMaps,
  currentMapId,
  explorerTree,
  selectMapById,
  mindMap,
}: WindowGlobalsBridgeParams) {

  // Bridge workspaces to sidebar via globals (quick wiring)
  useEffect(() => {
    (window as any).mindoodleWorkspaces = workspaces || [];
    (window as any).mindoodleAddWorkspace = async () => {
      try {
        await addWorkspace?.();
        await mindMap?.refreshMapList?.();
      } catch { }
    };
    (window as any).mindoodleRemoveWorkspace = async (id: string) => {
      try {
        await removeWorkspace?.(id);
        await mindMap?.refreshMapList?.();
      } catch { }
    };
  }, [workspaces, addWorkspace, removeWorkspace, mindMap]);

  // Expose map list and selector for keyboard shortcuts (Ctrl+P/N)
  useEffect(() => {
    try {
      (window as any).mindoodleAllMaps = allMindMaps || [];
      (window as any).mindoodleCurrentMapId = currentMapId || null;

      // Build ordered list of maps based on explorer tree (visual order)
      const ordered: Array<{ mapId: string; workspaceId: string | undefined }> = [];
      const tree: any = explorerTree;

      const visit = (node: any) => {
        if (!node) return;
        if (node.type === 'folder') {
          (node.children || []).forEach((c: any) => visit(c));
        } else if (node.type === 'file' && node.isMarkdown && typeof node.path === 'string') {
          const workspaceId = node.path.startsWith('/ws_') ? node.path.split('/')[1] : undefined;
          const mapId = node.path.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '');
          if (mapId) ordered.push({ mapId, workspaceId });
        }
      };

      visit(tree);
      (window as any).mindoodleOrderedMaps = ordered; // array of { mapId, workspaceId }

      // Debounced selector to avoid heavy reflows when switching rapidly
      (window as any).mindoodleSelectMapById = (mapId: string) => {
        try {
          // Skip if selecting the same map (use latest reflected on window to avoid stale closure)
          const curr: string | null = (window as any).mindoodleCurrentMapId || null;
          if (curr === mapId) return;

          const target = (allMindMaps || []).find((m: any) => m?.mapIdentifier?.mapId === mapId);
          if (!target) return;

          const pendingKey = `pending:${target.mapIdentifier.workspaceId}:${target.mapIdentifier.mapId}`;
          (window as any).__mindoodlePendingMapKey = pendingKey;

          if ((window as any).__mindoodleMapSwitchTimer) {
            clearTimeout((window as any).__mindoodleMapSwitchTimer);
          }

          (window as any).__mindoodleMapSwitchTimer = setTimeout(() => {
            try {
              // Ensure latest pending is still this target
              if ((window as any).__mindoodlePendingMapKey === pendingKey) {
                selectMapById(target.mapIdentifier);
              }
            } catch { }
          }, 150);
        } catch { }
      };
    } catch { }
  }, [allMindMaps, currentMapId, selectMapById, explorerTree]);
}
