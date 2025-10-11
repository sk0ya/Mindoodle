import { useEffect } from 'react';
import type { MapIdentifier, MindMapData } from '@shared/types';
import type { ExplorerItem } from '@core/types/storage.types';

interface WindowGlobalsBridgeParams {
  workspaces: Array<{ id: string; name: string }> | undefined;
  addWorkspace: (() => Promise<void>) | undefined;
  removeWorkspace: ((id: string) => Promise<void>) | undefined;
  allMindMaps: MindMapData[] | undefined;
  currentMapId: string | null;
  currentWorkspaceId?: string | null;
  explorerTree: ExplorerItem | null;
  selectMapById: (mapId: MapIdentifier) => Promise<void | boolean>;
  mindMap: {
    refreshMapList?: () => Promise<void>;
  };
}

// Extend Window interface for custom Mindoodle properties
interface MindoodleWindow extends Window {
  mindoodleWorkspaces: Array<{ id: string; name: string }>;
  mindoodleAddWorkspace: () => Promise<void>;
  mindoodleRemoveWorkspace: (id: string) => Promise<void>;
  mindoodleAllMaps: MindMapData[];
  mindoodleCurrentMapId: string | null;
  mindoodleCurrentWorkspaceId: string | null;
  mindoodleOrderedMaps: Array<{ mapId: string; workspaceId: string | undefined }>;
  mindoodleSelectMapById: (mapId: string) => void;
  __mindoodlePendingMapKey?: string;
  __mindoodleMapSwitchTimer?: ReturnType<typeof setTimeout>;
}

declare let window: MindoodleWindow;


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
    window.mindoodleWorkspaces = workspaces || [];
    window.mindoodleAddWorkspace = async () => {
      try {
        await addWorkspace?.();
        await mindMap?.refreshMapList?.();
      } catch { }
    };
    window.mindoodleRemoveWorkspace = async (id: string) => {
      try {
        await removeWorkspace?.(id);
        await mindMap?.refreshMapList?.();
      } catch { }
    };
  }, [workspaces, addWorkspace, removeWorkspace, mindMap]);


  useEffect(() => {
    try {
      window.mindoodleAllMaps = allMindMaps || [];
      window.mindoodleCurrentMapId = currentMapId || null;
      window.mindoodleCurrentWorkspaceId = currentWorkspaceId || null;


      const ordered: Array<{ mapId: string; workspaceId: string | undefined }> = [];
      const tree = explorerTree;

      const visit = (node: ExplorerItem) => {
        if (!node) return;
        if (node.type === 'folder') {
          (node.children || []).forEach((c: ExplorerItem) => visit(c));
        } else if (node.type === 'file' && node.isMarkdown && typeof node.path === 'string') {
          const workspaceId = node.path.startsWith('/ws_') ? node.path.split('/')[1] : undefined;
          const mapId = node.path.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '');
          if (mapId) ordered.push({ mapId, workspaceId });
        }
      };

      if (tree) visit(tree);
      window.mindoodleOrderedMaps = ordered; 


      const schedulePendingMapSwitch = (pendingKey: string, identifier: MapIdentifier, fn: (id: MapIdentifier) => Promise<void | boolean>) => {
        if (window.__mindoodlePendingMapKey === pendingKey) {
          fn(identifier).catch((err: unknown) => console.warn('map switch failed', err));
        }
      };

      window.mindoodleSelectMapById = (mapId: string) => {
        try {

          const curr: string | null = window.mindoodleCurrentMapId || null;
          if (curr === mapId) return;

          const target = (allMindMaps || []).find((m) => m?.mapIdentifier?.mapId === mapId);
          if (!target) return;

          const pendingKey = `pending:${target.mapIdentifier.workspaceId}:${target.mapIdentifier.mapId}`;
          window.__mindoodlePendingMapKey = pendingKey;

          if (window.__mindoodleMapSwitchTimer) {
            clearTimeout(window.__mindoodleMapSwitchTimer);
          }

          window.__mindoodleMapSwitchTimer = setTimeout(
            schedulePendingMapSwitch.bind(null, pendingKey, target.mapIdentifier, selectMapById),
            150
          );
        } catch (err) { console.warn('window message handler error', err); }
      };
    } catch { }
  }, [allMindMaps, currentMapId, currentWorkspaceId, selectMapById, explorerTree]);
}
