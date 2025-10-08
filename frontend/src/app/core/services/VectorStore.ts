/**
 * VectorStore - IndexedDBを使ったベクトルの永続化
 *
 * ファイルパスをキーとして、384次元のベクトル（Float32Array）を保存・取得します。
 */

const DB_NAME = 'mindoodle-vectors';
const DB_VERSION = 1;
const STORE_NAME = 'vectors';

interface VectorRecord {
  filePath: string; // Primary key
  vector: Float32Array;
  timestamp: number;
}

export class VectorStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * IndexedDBを初期化
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // vectors オブジェクトストア作成
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'filePath' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * ベクトルを保存
   */
  async saveVector(filePath: string, vector: Float32Array): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: VectorRecord = {
        filePath,
        vector,
        timestamp: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save vector for ${filePath}`));
    });
  }

  /**
   * ベクトルを取得
   */
  async getVector(filePath: string): Promise<Float32Array | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(filePath);

      request.onsuccess = () => {
        const record = request.result as VectorRecord | undefined;
        resolve(record?.vector || null);
      };

      request.onerror = () => reject(new Error(`Failed to get vector for ${filePath}`));
    });
  }

  /**
   * 全てのベクトルを取得
   */
  async getAllVectors(): Promise<Map<string, Float32Array>> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as VectorRecord[];
        const map = new Map<string, Float32Array>();

        for (const record of records) {
          map.set(record.filePath, record.vector);
        }

        resolve(map);
      };

      request.onerror = () => reject(new Error('Failed to get all vectors'));
    });
  }

  /**
   * ベクトルを削除
   */
  async deleteVector(filePath: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(filePath);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete vector for ${filePath}`));
    });
  }

  /**
   * 全てのベクトルを削除
   */
  async clear(): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear all vectors'));
    });
  }

  /**
   * データベースを閉じる
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// シングルトンインスタンス
export const vectorStore = new VectorStore();
