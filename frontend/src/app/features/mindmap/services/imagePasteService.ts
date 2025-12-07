import { readClipboardImageAsFile } from '@shared/utils/clipboard';
import { logger } from '@shared/utils';
import { StorageAdapter } from '@core/types';
import { WorkspaceService } from '@shared/services/WorkspaceService';

export interface ImagePasteService {
  pasteImageToNode(
    nodeId: string,
    storageAdapter: StorageAdapter,
    workspaceId?: string,
    mapId?: string,
    imageFileOverride?: File
  ): Promise<string>;
}


export class ImagePasteServiceImpl implements ImagePasteService {
  
  async pasteImageToNode(
    _nodeId: string,
    storageAdapter: StorageAdapter,
    workspaceId?: string,
    mapId?: string,
    imageFileOverride?: File
  ): Promise<string> {
    try {
      
      const imageFile = imageFileOverride ?? await readClipboardImageAsFile('image');

      
      const now = new Date();
      const dateStr = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('ja-JP', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(/:/g, '-');

      const extension = imageFile.type.split('/')[1] || 'png';
      const filename = `image-${dateStr}-${timeStr}.${extension}`;

      
      let mapDirectory = '';
      if (mapId) {
        const mapIdParts = mapId.split('/');
        if (mapIdParts.length > 1) {
          // Remove the last part (filename) to get directory
          mapDirectory = mapIdParts.slice(0, -1).join('/') + '/';
        }
      }

      // Create full path relative to workspace: mapDirectory + Resources/filename
      const fullImagePath = `${mapDirectory}Resources/${filename}`;
      // Relative path from map file: Resources/filename
      const relativeImagePath = `Resources/${filename}`;

      // Resolve correct adapter for target workspace (consider cloud)
      let usedWorkspaceSpecificAdapter = false;
      const effectiveAdapter: StorageAdapter = (() => {
        if (workspaceId) {
          // Try to get adapter bound to the workspace (e.g., 'cloud')
          try {
            const wsAdapter = WorkspaceService.getInstance().getStorageAdapterForWorkspace(workspaceId);
            if (wsAdapter) { usedWorkspaceSpecificAdapter = true; return wsAdapter; }
          } catch {}
        }
        return storageAdapter;
      })();

      


      if (effectiveAdapter && 'saveImageFile' in effectiveAdapter && typeof (effectiveAdapter as { saveImageFile?: (path: string, file: File, workspaceId?: string) => Promise<void> }).saveImageFile === 'function') {
        const wsIdArg = usedWorkspaceSpecificAdapter ? workspaceId : undefined;
        await (effectiveAdapter as { saveImageFile: (path: string, file: File, workspaceId?: string) => Promise<void> }).saveImageFile(fullImagePath, imageFile, wsIdArg);
      } else {
        throw new Error('Storage adapter does not support image saving');
      }

      return relativeImagePath;
    } catch (error) {
      logger.error('Failed to paste image:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to paste image');
    }
  }
}

export const imagePasteService = new ImagePasteServiceImpl();
