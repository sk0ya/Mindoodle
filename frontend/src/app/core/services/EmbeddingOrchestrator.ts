

import { embeddingService } from './EmbeddingService';
import { vectorStore } from './VectorStore';

export class EmbeddingOrchestrator {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;

  
  async processAllFiles(getAllFiles: () => Promise<Array<{ path: string; content: string }>>): Promise<void> {
    if (this.isProcessing) {
      console.warn('Already processing files');
      return;
    }

    this.isProcessing = true;

    try {
      
      const allFiles = await getAllFiles();

      
      const mdFiles = allFiles.filter(f => f.path.endsWith('.md'));

      
      const existingVectors = await vectorStore.getAllVectors();

      
      const unvectorizedFiles = mdFiles.filter(f => !existingVectors.has(f.path));

      if (unvectorizedFiles.length === 0) {
        console.log('All files are already vectorized');
        this.isProcessing = false;
        return;
      }

      console.log(`Vectorizing ${unvectorizedFiles.length} unvectorized files...`);

      
      window.dispatchEvent(new CustomEvent('vectorization-progress', {
        detail: {
          total: unvectorizedFiles.length,
          current: 0,
          status: 'started'
        }
      }));

      
      for (let i = 0; i < unvectorizedFiles.length; i++) {
        const file = unvectorizedFiles[i];

        try {
          const vector = await embeddingService.embed(file.path, file.content);
          await vectorStore.saveVector(file.path, vector);

          
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

  
  scheduleVectorUpdate(filePath: string, content: string, delayMs = 2000): void {
    
    if (!filePath.endsWith('.md')) {
      return;
    }

    
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    
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

  
  async deleteVector(filePath: string): Promise<void> {
    try {
      
      const existingTimer = this.debounceTimers.get(filePath);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(filePath);
      }

      
      await vectorStore.deleteVector(filePath);
      console.log(`Vector deleted: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete vector for ${filePath}:`, error);
    }
  }

  
  async clearAllVectors(): Promise<void> {
    try {
      
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      
      await vectorStore.clear();
      console.log('All vectors cleared');
    } catch (error) {
      console.error('Failed to clear all vectors:', error);
    }
  }

  
  isProcessingFiles(): boolean {
    return this.isProcessing;
  }
}


export const embeddingOrchestrator = new EmbeddingOrchestrator();
