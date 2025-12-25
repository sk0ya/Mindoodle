import React from 'react';
import { getStoreState } from '../../hooks/useStoreSelectors';
import type { MapIdentifier, MindMapNode } from '@shared/types';

interface Options {
  selectMapById: (id: MapIdentifier) => Promise<unknown> | void;
  selectNode: (id: string | null) => void;
  storageAdapter?: unknown;
}

export const useSidebarHandlers = ({ selectMapById, selectNode, storageAdapter }: Options) => {
  const onMapSwitch = React.useCallback(async (targetMapIdentifier: MapIdentifier) => {
    const currentMapData = getStoreState().data;
    if (
      currentMapData?.mapIdentifier?.mapId === targetMapIdentifier.mapId &&
      currentMapData?.mapIdentifier?.workspaceId === targetMapIdentifier.workspaceId
    ) {
      return;
    }
    const result = await selectMapById(targetMapIdentifier as any);
    void result; // normalize return to Promise<void>
  }, [selectMapById]);

  const onNodeSelectByLine = React.useCallback(async (lineNumber: number) => {
    const currentMapData = getStoreState().data;
    if (!currentMapData || !storageAdapter) return;

    try {
      let foundNodeId: string | null = null;
      const findNodeByMarkdownLine = (nodes: MindMapNode[]): boolean => {
        for (const node of nodes) {
          const nodeLineNumber = node.markdownMeta?.lineNumber;
          if (typeof nodeLineNumber === 'number' && nodeLineNumber + 1 === lineNumber) {
            foundNodeId = node.id;
            return true;
          }
          if (node.children && node.children.length > 0 && findNodeByMarkdownLine(node.children)) {
            return true;
          }
        }
        return false;
      };

      findNodeByMarkdownLine(currentMapData.rootNodes || []);
      if (foundNodeId) {
        selectNode(foundNodeId);
        // Auto-scroll handled by useAutoScrollToSelectedNode hook
      }
    } catch (error) {
      // keep silent to match original behaviour
      // eslint-disable-next-line no-console
      console.error('Error finding node by line number:', error);
    }
  }, [selectNode, storageAdapter]);

  return { onMapSwitch, onNodeSelectByLine };
};
