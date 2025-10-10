
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private ttl: number; 
  private timestamps = new Map<K, number>();

  constructor(maxSize = 1000, ttl = 300000) { 
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const now = Date.now();
    const timestamp = this.timestamps.get(key);

    
    if (timestamp && (now - timestamp) > this.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return undefined;
    }

    const value = this.cache.get(key);
    if (value !== undefined) {
      
      this.cache.delete(key);
      this.cache.set(key, value);
      this.timestamps.set(key, now);
    }

    return value;
  }

  set(key: K, value: V): void {
    const now = Date.now();

    
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      
      const iterator = this.cache.keys().next();
      const firstKey = iterator.value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.timestamps.delete(firstKey);
      }
    }

    this.cache.set(key, value);
    this.timestamps.set(key, now);
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    this.timestamps.delete(key);
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  size(): number {
    return this.cache.size;
  }

  
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, timestamp] of this.timestamps.entries()) {
      if ((now - timestamp) > this.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.timestamps.delete(key);
    });
  }
}
