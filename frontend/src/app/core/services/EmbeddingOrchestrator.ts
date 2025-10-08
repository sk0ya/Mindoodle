/**
 * EmbeddingOrchestrator - ファイルのベクトル化を統括管理
 *
 * - 初回起動時の一括ベクトル化
 * - ファイル変更時のベクトル更新（デバウンス付き）
 */

import { embeddingService } from './EmbeddingService';
import { vectorStore } from './VectorStore';

export class EmbeddingOrchestrator {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;

  /**
   * 全ての.mdファイルをスキャンして未ベクトル化のものをベクトル化
   */
  async processAllFiles(getAllFiles: () => Promise<Array<{ path: string; content: string }>>): Promise<void> {
    if (this.isProcessing) {
      console.warn('Already processing files');
      return;
    }

    this.isProcessing = true;

    try {
      // 全ファイル取得
      const allFiles = await getAllFiles();

      // .mdファイルのみフィルター
      const mdFiles = allFiles.filter(f => f.path.endsWith('.md'));

      // 既存のベクトルを取得
      const existingVectors = await vectorStore.getAllVectors();

      // 未ベクトル化のファイルを抽出
      const unvectorizedFiles = mdFiles.filter(f => !existingVectors.has(f.path));

      if (unvectorizedFiles.length === 0) {
        console.log('All files are already vectorized');
        this.isProcessing = false;
        return;
      }

      console.log(`Vectorizing ${unvectorizedFiles.length} unvectorized files...`);

      // プログレスイベント発火
      window.dispatchEvent(new CustomEvent('vectorization-progress', {
        detail: {
          total: unvectorizedFiles.length,
          current: 0,
          status: 'started'
        }
      }));

      // 順次ベクトル化
      for (let i = 0; i < unvectorizedFiles.length; i++) {
        const file = unvectorizedFiles[i];

        try {
          const vector = await embeddingService.embed(file.path, file.content);
          await vectorStore.saveVector(file.path, vector);

          // プログレスイベント発火
          window.dispatchEvent(new CustomEvent('vectorization-progress', {
            detail: {
              total: unvectorizedFiles.length,
              current: i + 1,
              status: 'processing',
              currentFile: file.path
            }
          }));

        } catch (error) {
          console.error(`Failed to vectorize ${file.path}:`, error);
        }
      }

      // 完了イベント
      window.dispatchEvent(new CustomEvent('vectorization-progress', {
        detail: {
          total: unvectorizedFiles.length,
          current: unvectorizedFiles.length,
          status: 'completed'
        }
      }));

      console.log('All files vectorized successfully');

    } catch (error) {
      console.error('Failed to process all files:', error);
      window.dispatchEvent(new CustomEvent('vectorization-progress', {
        detail: { status: 'error', error: error instanceof Error ? error.message : String(error) }
      }));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ファイル変更時にベクトルを更新（デバウンス付き）
   */
  scheduleVectorUpdate(filePath: string, content: string, delayMs = 2000): void {
    // .mdファイル以外は無視
    if (!filePath.endsWith('.md')) {
      return;
    }

    // 既存のタイマーをクリア
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 新しいタイマーをセット
    const timer = setTimeout(async () => {
      try {
        console.log(`Updating vector for: ${filePath}`);
        const vector = await embeddingService.embed(filePath, content);
        await vectorStore.saveVector(filePath, vector);
        console.log(`Vector updated: ${filePath}`);
        this.debounceTimers.delete(filePath);
      } catch (error) {
        console.error(`Failed to update vector for ${filePath}:`, error);
      }
    }, delayMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * ファイル削除時にベクトルを削除
   */
  async deleteVector(filePath: string): Promise<void> {
    try {
      // デバウンスタイマーがあればクリア
      const existingTimer = this.debounceTimers.get(filePath);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(filePath);
      }

      // ベクトル削除
      await vectorStore.deleteVector(filePath);
      console.log(`Vector deleted: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete vector for ${filePath}:`, error);
    }
  }

  /**
   * 全てのベクトルをクリア
   */
  async clearAllVectors(): Promise<void> {
    try {
      // 全てのデバウンスタイマーをクリア
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      // 全ベクトル削除
      await vectorStore.clear();
      console.log('All vectors cleared');
    } catch (error) {
      console.error('Failed to clear all vectors:', error);
    }
  }

  /**
   * 処理中かどうか
   */
  isProcessingFiles(): boolean {
    return this.isProcessing;
  }
}

// シングルトンインスタンス
export const embeddingOrchestrator = new EmbeddingOrchestrator();
