import { findNodeInRoots } from '@mindmap/utils';
import { imagePasteService } from '../services/imagePasteService';
import type { MindMapNode, MapIdentifier } from '@shared/types';
import type { StorageAdapter } from '@core/types';
import { useStableCallback } from '@shared/hooks';

export interface ClipboardOperationsParams {
  data: { rootNodes: MindMapNode[]; mapIdentifier?: MapIdentifier } | null;
  clipboard: MindMapNode | null;
  selectedNodeId: string | null;
  storageAdapter: StorageAdapter | null;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text: string) => string | undefined;
  selectNode: (id: string) => void;
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  refreshMapList: () => Promise<void>;
}


export function useMindMapClipboard({
  data,
  clipboard,
  selectedNodeId,
  storageAdapter,
  updateNode,
  addChildNode,
  selectNode,
  showNotification,
  refreshMapList,
}: ClipboardOperationsParams) {

  
  const pasteImageFromClipboard = useStableCallback(async (nodeId?: string, fileOverride?: File) => {
    try {
      
      const targetNodeId = nodeId || selectedNodeId;
      if (!targetNodeId) {
        showNotification('warning', '画像を貼り付けるノードを選択してください');
        return;
      }

      
      if (!storageAdapter) {
        showNotification('error', 'ストレージが初期化されていません');
        return;
      }

      
      const targetNode = findNodeInRoots(data?.rootNodes || [], targetNodeId);
      if (!targetNode) {
        showNotification('error', 'ノードが見つかりません');
        return;
      }

      
      const imagePath = await imagePasteService.pasteImageToNode(
        targetNodeId,
        storageAdapter,
        data?.mapIdentifier?.workspaceId,
        data?.mapIdentifier?.mapId,
        fileOverride
      );

      
      const currentNote = targetNode.note || '';
      const imageMarkdown = `![](${imagePath})`;
      const newNote = currentNote
        ? `${currentNote}\n\n${imageMarkdown}`
        : imageMarkdown;

      // Update the node with new note
      updateNode(targetNodeId, { note: newNote });

      // Refresh the explorer to show the new image file
      await refreshMapList();

      showNotification('success', '画像を貼り付けました');
    } catch (error) {
      console.error('Failed to paste image:', error);
      const message = error instanceof Error ? error.message : '画像の貼り付けに失敗しました';
      showNotification('error', message);
    }
  });

  
  const pasteNodeFromClipboard = useStableCallback(async (parentId: string) => {
    const { pasteFromClipboard } = await import('../utils/clipboardPaste');
    await pasteFromClipboard(
      parentId,
      clipboard,
      (parent: string, text: string) => addChildNode(parent, text),
      updateNode,
      selectNode,
      showNotification
    );
  });

  return {
    pasteImageFromClipboard,
    pasteNodeFromClipboard,
  };
}
