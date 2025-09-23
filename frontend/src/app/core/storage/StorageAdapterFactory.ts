import type { StorageAdapter, StorageMode, StorageAdapterFactory as IStorageAdapterFactory } from '../types/storage.types';
import { MarkdownFolderAdapter } from './adapters/MarkdownFolderAdapter';
import { logger } from '@shared/utils';

export class StorageAdapterFactory implements IStorageAdapterFactory {
  async create(): Promise<StorageAdapter> {
    return this.createMarkdownAdapter();
  }

  isSupported(mode: StorageMode): boolean {
    const supportedModes: StorageMode[] = ['markdown'];
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
}

export const defaultStorageAdapterFactory = new StorageAdapterFactory();

export async function createStorageAdapter(): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create();
}

