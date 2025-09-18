import { useEffect, useMemo, useRef } from 'react';
import type { MapIdentifier } from '@shared/types';
import type { StorageAdapter } from '../storage/types';
import { MarkdownStream, createLocalSink, type MarkdownSource } from '../streams/MarkdownStream';

interface UseMarkdownStreamOptions {
  debounceMs?: number;
}

export const useMarkdownStream = (
  adapter: Partial<StorageAdapter> | null | undefined,
  id: MapIdentifier | null | undefined,
  opts: UseMarkdownStreamOptions = {}
) => {
  const streamRef = useRef<MarkdownStream | null>(null);
  const mapKey = id ? `${id.workspaceId || ''}::${id.mapId}` : '';

  const stream = useMemo(() => {
    const s = new MarkdownStream({ debounceMs: opts.debounceMs ?? 200 });
    streamRef.current = s;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  // Attach sinks whenever adapter/id changes
  useEffect(() => {
    if (!id || !adapter) return;
    const localSink = createLocalSink('local', async (markdown: string) => {
      if (typeof (adapter as any).saveMapMarkdown === 'function') {
        await (adapter as any).saveMapMarkdown(id, markdown);
      }
    });
    stream.replaceSinks([localSink]);
  }, [adapter, id, stream]);

  // Load initial markdown for this map
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id || !adapter) return;
      try {
        if (typeof (adapter as any).getMapMarkdown === 'function') {
          const text: string | null = await (adapter as any).getMapMarkdown(id);
          if (!cancelled && typeof text === 'string') {
            stream.setMarkdown(text, 'external');
          }
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [adapter, id, stream]);

  return {
    stream,
    setFromEditor: (text: string) => stream.setMarkdown(text, 'editor' as MarkdownSource),
    setFromNodes: (text: string) => stream.setMarkdown(text, 'nodes' as MarkdownSource),
    getMarkdown: () => stream.getMarkdown(),
    subscribe: (cb: (markdown: string, source: MarkdownSource) => void) => stream.subscribe(cb)
  };
};

