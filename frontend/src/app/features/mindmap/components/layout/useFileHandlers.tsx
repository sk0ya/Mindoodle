import { logger } from '../../../../shared/utils/logger';
import { validateFile } from '../../../../shared/types/dataTypes';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { FileAttachment } from '@shared/types';

type Params = {
  data: any;
  updateNode: (id: string, updates: any) => void;
  showNotification: (type: 'success'|'error'|'info'|'warning', msg: string) => void;
  handleError: (error: Error, context?: string, action?: string) => void;
  handleAsyncError: (promise: Promise<any>, context?: string, action?: string) => Promise<any>;
  retryableUpload: <T>(key: string, name: string, task: () => Promise<T>) => Promise<T>;
};

export function useFileHandlers({
  data,
  updateNode, showNotification, handleError, handleAsyncError, retryableUpload,
}: Params) {
  const uploadFile = async (nodeId: string, file: File): Promise<void> => {
    if (!data) {
      handleError(new Error('マインドマップデータが利用できません'), 'ファイルアップロード', 'データチェック');
      return;
    }

    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      validationErrors.forEach((e: string) => showNotification('error', e));
      return;
    }

    const uploadKey = `${nodeId}_${file.name}_${Date.now()}`;
    try {
      await handleAsyncError((async () => {
        const fileAttachment = await retryableUpload(uploadKey, file.name, async (): Promise<FileAttachment> => {
          // ローカルモードのみサポート
          {
            const reader = new FileReader();
            const dataURL = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            return {
              id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              name: file.name,
              type: file.type,
              size: file.size,
              isImage: file.type.startsWith('image/'),
              createdAt: new Date().toISOString(),
              dataURL,
              data: dataURL.split(',')[1],
            } as FileAttachment;
          }
        });

        const target = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
        if (!target) throw new Error(`ノードが見つかりません: ${nodeId}`);
        const updated = { ...target, attachments: [...(target.attachments || []), fileAttachment] };
        updateNode(nodeId, updated);
        showNotification('success', `${file.name} を添付しました`);
      })(), 'ファイルアップロード', `${file.name}のアップロード`);
    } catch (error) {
      logger.error('File upload failed:', error);
      showNotification('error', `${file.name} のアップロードに失敗しました`);
    }
  };

  const downloadFile = async (file: FileAttachment): Promise<void> => {
    try {
      let downloadUrl = '';
      const fileName = file.name;

      if (file.data) {
        downloadUrl = `data:${file.type};base64,${file.data}`;
      } else if (file.dataURL) {
        downloadUrl = file.dataURL;
      } else {
        throw new Error('ダウンロード可能なファイルデータが見つかりません');
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (downloadUrl.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      logger.info('File download completed successfully:', fileName);
    } catch (error) {
      logger.error('File download failed:', error);
      showNotification('error', `${file.name} のダウンロードに失敗しました`);
      handleError(error as Error, 'ファイルダウンロード', file.name);
    }
  };

  const deleteFile = async (nodeId: string, fileId: string): Promise<void> => {
    try {
      if (!data) throw new Error('マインドマップデータが利用できません');
      const { findNodeById } = await import('../../../../shared/utils/nodeTreeUtils');
      const node = findNodeById(data.rootNode, nodeId);
      if (!node || !node.attachments) throw new Error('ノードまたは添付ファイルが見つかりません');
      const fileToDelete = node.attachments.find((f: FileAttachment) => f.id === fileId);
      if (!fileToDelete) throw new Error('削除するファイルが見つかりません');
      // クラウドモードサポート終了
      const updatedAttachments = node.attachments.filter((f: FileAttachment) => f.id !== fileId);
      updateNode(nodeId, { ...node, attachments: updatedAttachments });
      showNotification('success', `${fileToDelete.name} を削除しました`);
    } catch (error) {
      logger.error('File delete failed:', error);
      showNotification('error', 'ファイルの削除に失敗しました');
      handleError(error as Error, 'ファイル削除', fileId);
    }
  };

  return { uploadFile, downloadFile, deleteFile };
}
