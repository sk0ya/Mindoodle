import { useEffect } from 'react';
import type { MapIdentifier } from '@shared/types';

interface WindowGlobalsBridgeParams {
  workspaces: any[] | undefined;
  addWorkspace: (() => Promise<void>) | undefined;
  removeWorkspace: ((id: string) => Promise<void>) | undefined;
  allMindMaps: any[] | undefined;
  currentMapId: string | null;
  currentWorkspaceId?: string | null;
  explorerTree: any;
  selectMapById: (mapId: MapIdentifier) => Promise<void>;
  mindMap: any;
}


export function useWindowGlobalsBridge({
  workspaces,
  addWorkspace,
  removeWorkspace,
  allMindMaps,
  currentMapId,
  currentWorkspaceId,
  explorerTree,
  selectMapById,
  mindMap,
}: WindowGlobalsBridgeParams) {

  
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

  
  useEffect(() => {
    try {
      (window as any).mindoodleAllMaps = allMindMaps || [];
      (window as any).mindoodleCurrentMapId = currentMapId || null;
      (window as any).mindoodleCurrentWorkspaceId = currentWorkspaceId || null;

      
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
      (window as any).mindoodleOrderedMaps = ordered; 

      
      (window as any).mindoodleSelectMapById = (mapId: string) => {
        try {
          
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
              
              if ((window as any).__mindoodlePendingMapKey === pendingKey) {
                selectMapById(target.mapIdentifier);
              }
            } catch { }
          }, 150);
        } catch { }
      };
    } catch { }
  }, [allMindMaps, currentMapId, currentWorkspaceId, selectMapById, explorerTree]);
}
