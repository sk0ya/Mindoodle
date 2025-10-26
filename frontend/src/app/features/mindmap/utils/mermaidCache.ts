/**
 * Mermaid SVG cache - refactored with functional patterns
 * Reduced from 99 lines to 91 lines (8% reduction)
 */

interface CachedSVG {
  svg: string;
  dimensions: { width: number; height: number };
  timestamp: number;
}

const generateHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString();
};

class MermaidSVGCache {
  private cache = new Map<string, CachedSVG>();
  private readonly maxSize: number;
  private readonly maxAge: number;

  constructor(maxSize = 100, maxAge = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  private isExpired(cached: CachedSVG): boolean {
    return Date.now() - cached.timestamp > this.maxAge;
  }

  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    Array.from(this.cache.entries())
      .filter(([, value]) => now - value.timestamp > this.maxAge)
      .forEach(([key]) => this.cache.delete(key));

    // Remove oldest entries if over size limit
    if (this.cache.size > this.maxSize) {
      Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, this.cache.size - this.maxSize)
        .forEach(([key]) => this.cache.delete(key));
    }
  }

  get(code: string): CachedSVG | null {
    const key = generateHash(code);
    const cached = this.cache.get(key);

    if (!cached || this.isExpired(cached)) {
      if (cached) this.cache.delete(key);
      return null;
    }

    return cached;
  }

  set(code: string, svg: string, dimensions: { width: number; height: number }): void {
    this.cleanup();
    this.cache.set(generateHash(code), {
      svg,
      dimensions,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(code: string): boolean {
    return this.cache.delete(generateHash(code));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}

export const mermaidSVGCache = new MermaidSVGCache();
export { MermaidSVGCache };
