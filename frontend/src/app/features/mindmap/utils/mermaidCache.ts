interface CachedSVG {
  svg: string;
  dimensions: { width: number; height: number };
  timestamp: number;
}

class MermaidSVGCache {
  private cache = new Map<string, CachedSVG>();
  private readonly maxSize: number;
  private readonly maxAge: number; // ms

  constructor(maxSize = 100, maxAge = 30 * 60 * 1000) { // 30 minutes
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  private generateKey(code: string): string {
    // Simple hash function for caching key
    let hash = 0;
    if (code.length === 0) return hash.toString();
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Remove expired entries
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.maxAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    // Remove oldest entries if cache is too large
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  get(code: string): CachedSVG | null {
    const key = this.generateKey(code);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  set(code: string, svg: string, dimensions: { width: number; height: number }): void {
    this.cleanup();

    const key = this.generateKey(code);
    this.cache.set(key, {
      svg,
      dimensions,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}

// Global cache instance
export const mermaidSVGCache = new MermaidSVGCache();

// Export the cache class for testing or custom instances
export { MermaidSVGCache };