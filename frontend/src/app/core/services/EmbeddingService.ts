

interface WorkerMessage {
  type: 'init' | 'embed' | 'terminate';
  data?: {
    text?: string;
    filePath?: string;
  };
}

interface WorkerResponse {
  type: 'ready' | 'progress' | 'result' | 'error';
  data?: {
    vector?: number[];
    filePath?: string;
  } | string | unknown;
}

export interface EmbeddingProgress {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export class EmbeddingService {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private pendingTasks = new Map<string, {
    resolve: (result: Float32Array) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        
        this.worker = new Worker(
          new URL('../../features/mindmap/workers/embedding.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          this.handleMessage(e);
        };

        this.worker.onerror = (e) => {
          console.error('Worker error:', e);
          reject(new Error('Worker initialization failed'));
        };

        
        const message: WorkerMessage = { type: 'init' };
        this.worker.postMessage(message);

        
        const readyListener = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type === 'ready') {
            this.isReady = true;
            this.worker?.removeEventListener('message', readyListener);
            resolve();
          }
        };

        this.worker.addEventListener('message', readyListener);

        
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Embedding service initialization timeout'));
          }
        }, 60000);

      } catch (error) {
        reject(error);
      }
    });

    return this.initPromise;
  }

  
  async embed(filePath: string, text: string): Promise<Float32Array> {
    if (!this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      
      const timeout = setTimeout(() => {
        const task = this.pendingTasks.get(filePath);
        if (task) {
          this.pendingTasks.delete(filePath);
          reject(new Error(`Embedding timeout for ${filePath}`));
        }
      }, 90000);

      this.pendingTasks.set(filePath, { resolve, reject, timeout });

      const message: WorkerMessage = {
        type: 'embed',
        data: { filePath, text }
      };

      if (this.worker) {
        this.worker.postMessage(message);
      }
    });
  }

  
  private handleMessage(e: MessageEvent<WorkerResponse>): void {
    const { type, data } = e.data;

    switch (type) {
      case 'result': {
        const resultData = data as { vector: number[]; filePath: string };
        const task = this.pendingTasks.get(resultData.filePath);

        if (task) {
          clearTimeout(task.timeout);
          this.pendingTasks.delete(resultData.filePath);

          
          const vector = new Float32Array(resultData.vector);
          task.resolve(vector);
        }
        break;
      }

      case 'progress': {
        
        const progressData = data as EmbeddingProgress;
        window.dispatchEvent(new CustomEvent('embedding-progress', {
          detail: progressData
        }));
        break;
      }

      case 'error': {
        const errorMessage = typeof data === 'string' ? data : 'Unknown error';
        console.error('Embedding error:', errorMessage);

        
        for (const task of this.pendingTasks.values()) {
          clearTimeout(task.timeout);
          task.reject(new Error(errorMessage));
        }
        this.pendingTasks.clear();
        break;
      }
    }
  }

  
  terminate(): void {
    if (this.worker) {
      const message: WorkerMessage = { type: 'terminate' };
      this.worker.postMessage(message);
      this.worker = null;
    }

    this.isReady = false;
    this.initPromise = null;

    
    for (const task of this.pendingTasks.values()) {
      clearTimeout(task.timeout);
      task.reject(new Error('Service terminated'));
    }
    this.pendingTasks.clear();
  }

  
  getStatus(): { ready: boolean; pendingTasks: number } {
    return {
      ready: this.isReady,
      pendingTasks: this.pendingTasks.size,
    };
  }
}


export const embeddingService = new EmbeddingService();
