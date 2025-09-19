export type MarkdownSource = 'nodes' | 'editor' | 'external';

export interface MarkdownSink {
  id: string;
  flush: (markdown: string) => Promise<void>;
}

export interface MarkdownStreamOptions {
  debounceMs?: number;
}

/**
 * In-memory Markdown stream that fans out to registered sinks (debounced + serialized).
 * - Keep a single source of truth for the current markdown text
 * - Notify subscribers on changes
 * - Flush changes to sinks with debounce; serialize to avoid races
 */
export class MarkdownStream {
  private content = '';
  private lastFlushed = '';
  private sinks: MarkdownSink[] = [];
  private subscribers = new Set<(markdown: string, source: MarkdownSource) => void>();
  private debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushLock: Promise<void> = Promise.resolve();

  constructor(opts: MarkdownStreamOptions = {}) {
    this.debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : 200;
  }

  getMarkdown(): string { return this.content; }

  setMarkdown(markdown: string, source: MarkdownSource = 'external'): void {
    if (typeof markdown !== 'string') return;
    if (markdown === this.content) return; // no-op

    this.content = markdown;
    this.notify(markdown, source);
    this.scheduleFlush();
  }

  replaceSinks(next: MarkdownSink[]): void {
    this.sinks = Array.isArray(next) ? next.slice() : [];
  }

  addSink(sink: MarkdownSink): void {
    this.sinks.push(sink);
  }

  subscribe(cb: (markdown: string, source: MarkdownSource) => void): () => void {
    this.subscribers.add(cb);
    // Don't emit initial content to prevent feedback loops
    // Initial content will be loaded via proper load mechanism in useMarkdownStream
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(markdown: string, source: MarkdownSource): void {
    console.log('📢 MarkdownStream.notify', { source, length: markdown.length, subscribers: this.subscribers.size });
    for (const cb of Array.from(this.subscribers)) {
      try { cb(markdown, source); } catch (_e) { /* ignore subscriber error */ void 0; }
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
    if (snapshot === this.lastFlushed) return; // no changes
    const run = async () => {
      // Re-check after awaiting previous lock
      const now = this.content;
      if (now === this.lastFlushed) return;
      // Fan-out sequentially; if one sink fails, continue others
      for (const sink of this.sinks) {
        try {
          await sink.flush(now);
        } catch {
          // Swallow to keep pipeline alive
        }
      }
      this.lastFlushed = now;
    };
    this.flushLock = this.flushLock.then(run).catch(() => {}).finally(() => {});
    await this.flushLock;
  }
}

export function createLocalSink(id: string, save: (markdown: string) => Promise<void>): MarkdownSink {
  return { id, flush: save };
}
