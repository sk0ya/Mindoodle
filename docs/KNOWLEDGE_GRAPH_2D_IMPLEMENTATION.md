# Knowledge Graph 2D Implementation Plan

## Overview

3D KnowledgeGraphを廃止し、Transformers.jsを使った2Dベクトル空間可視化に移行する。

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         User Actions                         │
│  ファイル編集 │ グラフ表示 │ 設定でグラフ機能ON/OFF       │
└───────┬─────────────────┬──────────────────┬───────────────┘
        │                 │                  │
        ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Settings   │  │MemoryService │  │EmbeddingService│
│knowledgeGraph│  │(編集監視)    │  │(Worker管理)   │
│.enabled:bool │  └──────┬───────┘  └──────┬────────┘
└──────────────┘         │                  │
                         │ debounce(2s)     │
                         ▼                  ▼
                  ┌──────────────────────────────┐
                  │   EmbeddingWorker (Web Worker)│
                  │   - Transformers.js          │
                  │   - Model: multilingual-e5   │
                  │   - Output: 384次元ベクトル  │
                  └──────────┬───────────────────┘
                             │
                             ▼
                  ┌──────────────────────────────┐
                  │   VectorStore (IndexedDB)    │
                  │   - Key: filePath            │
                  │   - Value: Float32Array(384) │
                  └──────────┬───────────────────┘
                             │
                             ▼
                  ┌──────────────────────────────┐
                  │  ForceDirectedLayout         │
                  │  - コサイン類似度計算        │
                  │  - 2D座標計算                │
                  └──────────┬───────────────────┘
                             │
                             ▼
                  ┌──────────────────────────────┐
                  │  KnowledgeGraphModal2D       │
                  │  - Canvas 2D描画             │
                  │  - インタラクション          │
                  └──────────────────────────────┘
```

## Implementation Phases

### Phase 1: 基礎インフラ (Settings, VectorStore)

**Files to create/modify:**
- `frontend/src/app/core/types/settings.ts` - knowledgeGraph設定追加
- `frontend/src/app/core/services/VectorStore.ts` - IndexedDB実装

**Tasks:**
1. Settings型にknowledgeGraph.enabled追加
2. VectorStoreクラス実装
   - `saveVector(filePath: string, vector: Float32Array): Promise<void>`
   - `getVector(filePath: string): Promise<Float32Array | null>`
   - `getAllVectors(): Promise<Map<string, Float32Array>>`
   - `deleteVector(filePath: string): Promise<void>`
   - `clear(): Promise<void>`

**IndexedDB Schema:**
```typescript
{
  dbName: 'mindoodle-vectors',
  version: 1,
  stores: {
    vectors: {
      keyPath: 'filePath',
      indexes: {
        timestamp: 'timestamp'
      }
    }
  }
}
```

### Phase 2: Embedding Pipeline (Worker, Service)

**Files to create:**
- `frontend/src/app/features/mindmap/workers/embedding.worker.ts`
- `frontend/src/app/core/services/EmbeddingService.ts`

**embedding.worker.ts:**
```typescript
import { pipeline, env } from '@xenova/transformers';

// キャッシュディレクトリ設定
env.allowLocalModels = false;
env.useBrowserCache = true;

let embedder: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'init':
        // モデルロード（初回のみ）
        embedder = await pipeline(
          'feature-extraction',
          'Xenova/multilingual-e5-small',
          { progress_callback: (progress) => {
            self.postMessage({ type: 'progress', data: progress });
          }}
        );
        self.postMessage({ type: 'ready' });
        break;

      case 'embed':
        if (!embedder) {
          throw new Error('Embedder not initialized');
        }
        const output = await embedder(data.text, {
          pooling: 'mean',
          normalize: true
        });
        const vector = Array.from(output.data);
        self.postMessage({ type: 'result', data: { vector, filePath: data.filePath } });
        break;

      case 'terminate':
        self.close();
        break;
    }
  } catch (error) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
```

**EmbeddingService.ts:**
```typescript
export class EmbeddingService {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private pendingTasks = new Map<string, (result: Float32Array) => void>();

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      this.worker = new Worker(
        new URL('../features/mindmap/workers/embedding.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (e) => reject(e);

      this.worker.postMessage({ type: 'init' });

      // ready待ち
      const readyListener = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          this.isReady = true;
          resolve();
        }
      };
      this.worker.addEventListener('message', readyListener, { once: true });
    });

    return this.initPromise;
  }

  async embed(filePath: string, text: string): Promise<Float32Array> {
    if (!this.isReady) await this.initialize();

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(filePath, resolve);
      this.worker!.postMessage({
        type: 'embed',
        data: { filePath, text }
      });

      setTimeout(() => {
        if (this.pendingTasks.has(filePath)) {
          this.pendingTasks.delete(filePath);
          reject(new Error('Embedding timeout'));
        }
      }, 30000); // 30秒タイムアウト
    });
  }

  private handleMessage(e: MessageEvent) {
    const { type, data } = e.data;

    switch (type) {
      case 'result':
        const callback = this.pendingTasks.get(data.filePath);
        if (callback) {
          callback(new Float32Array(data.vector));
          this.pendingTasks.delete(data.filePath);
        }
        break;

      case 'progress':
        // プログレスバー更新（UI側で処理）
        window.dispatchEvent(new CustomEvent('embedding-progress', { detail: data }));
        break;

      case 'error':
        console.error('Embedding error:', data);
        break;
    }
  }

  terminate() {
    this.worker?.postMessage({ type: 'terminate' });
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
  }
}

export const embeddingService = new EmbeddingService();
```

### Phase 3: ファイル編集監視

**Files to modify:**
- `frontend/src/app/core/services/MemoryService.ts`

**Implementation:**
```typescript
// MemoryService内に追加
private embeddingDebounceTimers = new Map<string, NodeJS.Timeout>();

private scheduleEmbedding(filePath: string, content: string) {
  // 既存のタイマーをクリア
  const existingTimer = this.embeddingDebounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // 2秒後にベクトル化
  const timer = setTimeout(async () => {
    try {
      const vector = await embeddingService.embed(filePath, content);
      await vectorStore.saveVector(filePath, vector);
      this.embeddingDebounceTimers.delete(filePath);
    } catch (error) {
      console.error('Failed to embed file:', filePath, error);
    }
  }, 2000);

  this.embeddingDebounceTimers.set(filePath, timer);
}

// updateFile内で呼び出し
async updateFile(filePath: string, content: string) {
  // 既存の処理...

  // ベクトル化スケジュール
  const settings = await settingsService.getSettings();
  if (settings.knowledgeGraph.enabled) {
    this.scheduleEmbedding(filePath, content);
  }
}
```

### Phase 4: Force-Directed Layout

**Files to create:**
- `frontend/src/app/features/mindmap/utils/forceDirectedLayout.ts`

**Implementation:**
```typescript
export interface Node2D {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vector: Float32Array;
}

export class ForceDirectedLayout {
  private nodes: Node2D[] = [];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setNodes(nodeData: Array<{ id: string; vector: Float32Array }>) {
    // ランダム初期配置
    this.nodes = nodeData.map(d => ({
      ...d,
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
    }));
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  step(alpha = 0.3) {
    const k_attraction = 0.01;
    const k_repulsion = 100;

    // 力の初期化
    for (const node of this.nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    // ノード間の力を計算
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;

        // コサイン類似度に基づく引力
        const similarity = this.cosineSimilarity(a.vector, b.vector);
        const attractionForce = similarity * k_attraction * distance;

        // 反発力（重ならないように）
        const repulsionForce = k_repulsion / (distance * distance);

        const fx = (dx / distance) * (attractionForce - repulsionForce);
        const fy = (dy / distance) * (attractionForce - repulsionForce);

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // 位置更新
    for (const node of this.nodes) {
      node.x += node.vx * alpha;
      node.y += node.vy * alpha;

      // 境界内に収める
      node.x = Math.max(50, Math.min(this.width - 50, node.x));
      node.y = Math.max(50, Math.min(this.height - 50, node.y));
    }
  }

  simulate(iterations = 100) {
    for (let i = 0; i < iterations; i++) {
      const alpha = 1 - (i / iterations); // 徐々に減衰
      this.step(alpha);
    }
  }

  getNodes(): Node2D[] {
    return this.nodes;
  }
}
```

### Phase 5: KnowledgeGraphModal2D

**Files to create:**
- `frontend/src/app/features/mindmap/components/modals/KnowledgeGraphModal2D.tsx`

**Implementation:**
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { vectorStore } from '@/core/services/VectorStore';
import { ForceDirectedLayout, Node2D } from '../../utils/forceDirectedLayout';

export const KnowledgeGraphModal2D: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node2D[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    loadAndLayout();
  }, [isOpen]);

  const loadAndLayout = async () => {
    // ベクトルを全て読み込み
    const vectors = await vectorStore.getAllVectors();

    if (vectors.size === 0) {
      return; // ベクトルがない
    }

    const nodeData = Array.from(vectors.entries()).map(([id, vector]) => ({
      id,
      vector,
    }));

    // レイアウト計算
    const layout = new ForceDirectedLayout(800, 600);
    layout.setNodes(nodeData);
    layout.simulate(150);

    setNodes(layout.getNodes());
  };

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ノード描画
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = hoveredNode === node.id ? '#3b82f6' : '#6b7280';
      ctx.fill();

      // ラベル
      if (hoveredNode === node.id) {
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.fillText(node.id.split('/').pop()!, node.x + 12, node.y);
      }
    }
  }, [nodes, hoveredNode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ホバー検出
    const hovered = nodes.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 10;
    });

    setHoveredNode(hovered?.id || null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      // ファイルを開く
      window.dispatchEvent(new CustomEvent('open-file', {
        detail: { filePath: hoveredNode }
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Knowledge Graph (2D)</h2>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border border-gray-300 cursor-pointer"
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
};
```

### Phase 6: 統合と置き換え

**Tasks:**
1. 既存の`KnowledgeGraphModal.tsx`を削除
2. 呼び出し側を`KnowledgeGraphModal2D`に変更
3. Three.js関連の依存を削除（package.jsonから）

## Dependencies

**New:**
```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0"
  }
}
```

**Remove (if not used elsewhere):**
```json
{
  "dependencies": {
    "three": "...",
    "@types/three": "..."
  }
}
```

## Settings Schema

```typescript
export interface AppSettings {
  // 既存の設定...

  knowledgeGraph: {
    enabled: boolean; // デフォルト: false
    modelDownloaded: boolean; // 内部管理用
  };
}
```

## Performance Considerations

- **モデルサイズ**: ~100MB (初回のみダウンロード、Cache APIで永続化)
- **ベクトル化時間**: 500-2000文字で300-600ms
- **メモリ消費**: ベクトル100個で約150KB
- **レイアウト計算**: 100ノードで100ms程度

## Future Enhancements

1. **Worker Pool**: 初回の一括ベクトル化を高速化
2. **UMAP**: より高品質な次元削減
3. **クラスタリング**: k-meansでグループ検出
4. **増分レイアウト**: 新ノード追加時の最適化
5. **エッジ描画**: 類似度の高いノード間にリンク表示

## Testing Plan

1. **Unit Tests**:
   - VectorStore CRUD操作
   - ForceDirectedLayout計算精度
   - コサイン類似度計算

2. **Integration Tests**:
   - Worker通信
   - ファイル編集 → ベクトル化フロー
   - モーダル表示とインタラクション

3. **Manual Tests**:
   - 10-100ファイルでのパフォーマンス
   - モデルダウンロード進捗表示
   - オフライン動作確認
