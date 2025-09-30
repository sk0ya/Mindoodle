import type { StorageAdapter, StorageMode, StorageConfig, StorageAdapterFactory as IStorageAdapterFactory } from '../types/storage.types';
import { MarkdownFolderAdapter, CloudStorageAdapter } from './adapters';
import { logger } from '@shared/utils';

export class StorageAdapterFactory implements IStorageAdapterFactory {
  async create(config: StorageConfig): Promise<StorageAdapter> {
    switch (config.mode) {
      case 'local':
        return this.createMarkdownAdapter();
      case 'local+cloud':
        return this.createCloudAdapter(config);
      default:
        throw new Error(`Unsupported storage mode: ${config.mode}`);
    }
  }

  isSupported(mode: StorageMode): boolean {
    const supportedModes: StorageMode[] = ['local', 'local+cloud'];
    return supportedModes.includes(mode);
  }

  static isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  private async createMarkdownAdapter(): Promise<StorageAdapter> {
    const adapter = new MarkdownFolderAdapter();
    await adapter.initialize();
    logger.info('StorageAdapterFactory: Markdown folder adapter created');
    return adapter;
  }

  private async createCloudAdapter(config: StorageConfig): Promise<StorageAdapter> {
    const adapter = new CloudStorageAdapter(config.cloudApiEndpoint);
    await adapter.initialize();
    logger.info('StorageAdapterFactory: Cloud storage adapter created');
    return adapter;
  }
}

export const defaultStorageAdapterFactory = new StorageAdapterFactory();

export async function createStorageAdapter(config?: StorageConfig): Promise<StorageAdapter> {
  const defaultConfig: StorageConfig = {
    mode: 'local',
    autoSave: true
  };
  return defaultStorageAdapterFactory.create(config || defaultConfig);
}

