

import { useStableCallback } from '@shared/hooks';
import { findNodeById, findNodeInRoots } from '@mindmap/utils';
import { relPathBetweenMapIds, logger } from '@shared/utils';
import { computeAnchorForNode } from '../../markdown';

import type { MindMapData, MindMapNode, NodeLink, MapIdentifier } from '@shared/types';

export interface UseMindMapLinksParams {
  data: MindMapData | null;
  loadMapData: (identifier: MapIdentifier) => Promise<MindMapData | null>;
  onOpenModal: (editingLink: NodeLink | null, nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onDeleteLink: (nodeId: string, linkId: string) => void;
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  handleError: (error: Error, context: string, operation: string) => void;
}

export function useMindMapLinks(params: UseMindMapLinksParams) {
  const {
    data,
    loadMapData,
    onOpenModal,
    onUpdateNode,
    onDeleteLink,
    showNotification,
    handleError,
  } = params;

  
  const handleAddLink = useStableCallback((nodeId: string) => {
    onOpenModal(null, nodeId);
  });

  
  const handleEditLink = useStableCallback((link: NodeLink, nodeId: string) => {
    logger.debug('handleEditLink', { link, nodeId });
    onOpenModal(link, nodeId);
  });

  
  const handleSaveLink = useStableCallback(async (linkData: Partial<NodeLink>, nodeId: string) => {
    if (!nodeId || !data) return;

    try {
      const rootNodes = data.rootNodes || [];
      let destNode: MindMapNode | null = null;

      for (const rootNode of rootNodes) {
        destNode = findNodeById(rootNode, nodeId);
        if (destNode) break;
      }

      if (!destNode) return;

      const currentMapId = data.mapIdentifier.mapId;
      const targetMapId = linkData.targetMapId || currentMapId;
      let label = 'リンク';
      let href = '';

      // Determine label and href based on target
      if (targetMapId === currentMapId) {
        // Same map link
        if (linkData.targetNodeId) {
          const targetNode = findNodeInRoots(data.rootNodes || [], linkData.targetNodeId);
          if (targetNode) {
            label = targetNode.text || 'リンク';
            const anchor = linkData.targetAnchor || computeAnchorForNode(data.rootNodes?.[0], targetNode.id) || label;
            href = `#${anchor}`;
          }
        } else {
          // Current map without node → center root (no anchor)
          label = data.title || 'このマップ';
          // href は空のまま（再代入しない）
        }
      } else {
        // Different map link
        const targetMap = await loadMapData({ mapId: targetMapId, workspaceId: data.mapIdentifier.workspaceId });
        if (targetMap) {
          if (linkData.targetNodeId) {
            const targetRootNodes = targetMap.rootNodes || [];
            let targetNode: MindMapNode | null = null;

            for (const rootNode of targetRootNodes) {
              targetNode = findNodeById(rootNode, linkData.targetNodeId);
              if (targetNode) break;
            }

            if (targetNode) {
              label = targetNode.text || targetMap.title || 'リンク';
              const anchor = linkData.targetAnchor || computeAnchorForNode(targetMap.rootNodes?.[0], targetNode.id);
              const rel = relPathBetweenMapIds(currentMapId, targetMap.mapIdentifier.mapId);
              href = anchor ? `${rel}#${encodeURIComponent(anchor)}` : rel;
            }
          } else {
            label = targetMap.title || 'リンク';
            const rel = relPathBetweenMapIds(currentMapId, targetMap.mapIdentifier.mapId);
            href = rel;
          }
        }
      }

      // Append link to node's note
      const currentNote = destNode.note || '';
      const prefix = currentNote.trim().length > 0 ? '\n\n' : '';
      const linkText = href ? `[${label}](${href})` : `[${label}]`;
      const appended = `${currentNote}${prefix}${linkText}\n`;

      onUpdateNode(nodeId, { note: appended });
      showNotification('success', 'ノートにリンクを追加しました');
    } catch (error) {
      logger.error('Link save error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの保存');
    }
  });

  
  const handleDeleteLink = useStableCallback(async (nodeId: string, linkId: string) => {
    if (!nodeId) return;

    try {
      onDeleteLink(nodeId, linkId);
      showNotification('success', 'リンクを削除しました');
    } catch (error) {
      logger.error('Link delete error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの削除');
    }
  });

  return {
    handleAddLink,
    handleEditLink,
    handleSaveLink,
    handleDeleteLink,
  };
}
