import { readClipboardImageAsFile } from '@shared/utils/clipboard';
import { StorageAdapter } from '@core/types';

export interface ImagePasteService {
  pasteImageToNode(nodeId: string, storageAdapter: StorageAdapter, workspaceId?: string, mapId?: string): Promise<string>;
}

/**
 * Service for handling image paste functionality
 */
export class ImagePasteServiceImpl implements ImagePasteService {
  /**
   * Paste image from clipboard to a node
   * @param nodeId - Target node ID (unused but kept for interface compatibility)
   * @param storageAdapter - Storage adapter instance
   * @param workspaceId - Optional workspace ID
   * @returns Promise<string> - The relative path to the saved image
   */
  async pasteImageToNode(_nodeId: string, storageAdapter: StorageAdapter, workspaceId?: string, mapId?: string): Promise<string> {
    try {
      // Read image from clipboard
      const imageFile = await readClipboardImageAsFile('image');

      // Generate descriptive filename with timestamp
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

      // Calculate the directory where the map file is located
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

      // Save image file using storage adapter
      if ('saveImageFile' in storageAdapter && typeof storageAdapter.saveImageFile === 'function') {
        await (storageAdapter as any).saveImageFile(fullImagePath, imageFile, workspaceId);
      } else {
        throw new Error('Storage adapter does not support image saving');
      }

      return relativeImagePath;
    } catch (error) {
      console.error('Failed to paste image:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to paste image');
    }
  }
}

export const imagePasteService = new ImagePasteServiceImpl();