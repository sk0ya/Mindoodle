export type MarkdownSource = 'nodes' | 'editor' | 'external';

export interface MarkdownSink {
  id: string;
  flush: (markdown: string) => Promise<void>;
}

export interface MarkdownStreamOptions {
  debounceMs?: number;
}

import { logger } from '@shared/utils';

export class MarkdownStream {
  private content = '';
  private lastFlushed = '';
  private lastUpdatedAt: string = '';
  private sinks: MarkdownSink[] = [];
  private subscribers = new Set<(markdown: string, source: MarkdownSource, updatedAt?: string) => void>();
  private debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushLock: Promise<void> = Promise.resolve();

  constructor(opts: MarkdownStreamOptions = {}) {
    this.debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : 200;
  }

  getMarkdown(): string { return this.content; }

  setMarkdown(markdown: string, source: MarkdownSource = 'external', updatedAt?: string): void {
    if (typeof markdown !== 'string') return;

    
    if (markdown === this.content) return;

    
    if (updatedAt && updatedAt === this.lastUpdatedAt) return;

    this.content = markdown;
    if (updatedAt) {
      this.lastUpdatedAt = updatedAt;
    }
    this.notify(markdown, source, updatedAt);
    this.scheduleFlush();
  }

  replaceSinks(next: MarkdownSink[]): void {
    this.sinks = Array.isArray(next) ? next.slice() : [];
  }

  addSink(sink: MarkdownSink): void {
    this.sinks.push(sink);
  }

  subscribe(cb: (markdown: string, source: MarkdownSource, updatedAt?: string) => void): () => void {
    this.subscribers.add(cb);
    
    
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(markdown: string, source: MarkdownSource, updatedAt?: string): void {
    logger.debug('📢 MarkdownStream.notify', { source, length: markdown.length, updatedAt, subscribers: this.subscribers.size });
    for (const cb of Array.from(this.subscribers)) {
      try {
        cb(markdown, source, updatedAt);
      } catch (err) {
        logger.warn('MarkdownStream subscriber error', err);
      }
    }
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    const snapshot = this.content;
    if (snapshot === this.lastFlushed) return; 
    const run = async () => {
      
      const now = this.content;
      if (now === this.lastFlushed) return;
      
      for (const sink of this.sinks) {
        try {
          await sink.flush(now);
        } catch (err) {
          logger.warn('MarkdownStream sink flush error', { id: sink.id, error: err });
        }
      }
      this.lastFlushed = now;
    };
    this.flushLock = this.flushLock
      .then(run)
      .catch((err) => {
        logger.warn('MarkdownStream flushLock chain error', err);
      });
    await this.flushLock;
  }
}

export function createLocalSink(id: string, save: (markdown: string) => Promise<void>): MarkdownSink {
  return { id, flush: save };
}
