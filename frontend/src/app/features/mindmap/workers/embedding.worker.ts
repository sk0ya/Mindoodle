/**
 * EmbeddingWorker - Transformers.jsを使ったテキストベクトル化
 *
 * Web Workerで動作し、メインスレッドをブロックせずにベクトル化を実行します。
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Transformers.js設定
env.allowLocalModels = false;
env.useBrowserCache = true;

let embedder: FeatureExtractionPipeline | null = null;

interface WorkerMessage {
  type: 'init' | 'embed' | 'terminate';
  data?: {
    text?: string;
    filePath?: string;
  };
}

interface WorkerResponse {
  type: 'ready' | 'progress' | 'result' | 'error';
  data?: unknown;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'init': {
        // モデルロード（初回のみ）
        embedder = await pipeline(
          'feature-extraction',
          'Xenova/multilingual-e5-small',
          {
            progress_callback: (progress: unknown) => {
              const response: WorkerResponse = {
                type: 'progress',
                data: progress
              };
              self.postMessage(response);
            },
          }
        );

        const response: WorkerResponse = { type: 'ready' };
        self.postMessage(response);
        break;
      }

      case 'embed': {
        if (!embedder) {
          throw new Error('Embedder not initialized');
        }

        if (!data?.text || !data?.filePath) {
          throw new Error('Missing text or filePath');
        }

        // ベクトル化実行
        const output = await embedder(data.text, {
          pooling: 'mean',
          normalize: true,
        });

        // Float32ArrayをArrayに変換（postMessage用）
        const vector = Array.from(output.data as Float32Array);

        const response: WorkerResponse = {
          type: 'result',
          data: { vector, filePath: data.filePath },
        };
        self.postMessage(response);
        break;
      }

      case 'terminate': {
        self.close();
        break;
      }

      default: {
        throw new Error(`Unknown message type: ${type}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = {
      type: 'error',
      data: errorMessage,
    };
    self.postMessage(response);
  }
};
