// Storage adapter factory - creates appropriate storage adapter based on configuration
import type { StorageAdapter, StorageConfig, StorageMode, StorageAdapterFactory as IStorageAdapterFactory } from '../types/storage.types';
import { MarkdownFolderAdapter } from './adapters/MarkdownFolderAdapter';
import { logger } from '@shared/utils';

/**
 * ストレージアダプターファクトリー
 * 設定に基づいて適切なストレージアダプターを作成
 */
export class StorageAdapterFactory implements IStorageAdapterFactory {
  /**
   * 設定に基づいてストレージアダプターを作成
   */
  async create(config: StorageConfig): Promise<StorageAdapter> {
    // 設定検証
    this.validateConfig(config);

    // Mindoodle: always use markdown folder adapter
    return this.createMarkdownAdapter();
  }

  /**
   * 指定されたモードがサポートされているかチェック
   */
  isSupported(mode: StorageMode): boolean {
    const supportedModes: StorageMode[] = ['markdown'];
    return supportedModes.includes(mode);
  }

  /**
   * ブラウザがIndexedDBをサポートしているかチェック
   */
  static isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * 設定の検証
   */
  private validateConfig(_config: StorageConfig): void {
    // no validation needed for markdown mode
  }

  /**
   * ローカルストレージアダプターを作成
   */
  // Removed local/cloud adapter creation for Mindoodle

  /**
   * Markdownフォルダアダプターを作成
   */
  private async createMarkdownAdapter(): Promise<StorageAdapter> {
    const adapter = new MarkdownFolderAdapter();
    await adapter.initialize();
    logger.info('StorageAdapterFactory: Markdown folder adapter created');
    return adapter;
  }

}

/**
 * デフォルトファクトリーインスタンス
 */
export const defaultStorageAdapterFactory = new StorageAdapterFactory();

/**
 * 便利な関数 - 設定に基づいてストレージアダプターを作成
 */
export async function createStorageAdapter(config: StorageConfig): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create(config);
}

/**
 * 便利な関数 - デフォルト設定でローカルアダプターを作成
 */
// Removed helper creators for local/cloud

