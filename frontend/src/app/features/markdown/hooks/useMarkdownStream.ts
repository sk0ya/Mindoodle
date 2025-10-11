import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MapIdentifier } from '@shared/types';
import type { StorageAdapter } from '@core/types';
import { MarkdownStream, createLocalSink, type MarkdownSource } from '../services/MarkdownStream';

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
      if (typeof (adapter as Partial<Record<string, unknown>>).saveMapMarkdown === 'function') {
        await (adapter as { saveMapMarkdown: (id: MapIdentifier, markdown: string) => Promise<void> }).saveMapMarkdown(id, markdown);
      }
    });
    stream.replaceSinks([localSink]);
  }, [adapter, id, stream]);

  
  useEffect(() => {
    let cancelled = false;
    const lastLoadedRef = { value: '' };

    const load = async () => {
      if (!id || !adapter) return;
      try {
        if (typeof (adapter as Partial<Record<string, unknown>>).getMapMarkdown === 'function') {
          const text: string | null = await (adapter as { getMapMarkdown: (id: MapIdentifier) => Promise<string | null> }).getMapMarkdown(id);
          if (!cancelled && typeof text === 'string' && text !== lastLoadedRef.value) {
            lastLoadedRef.value = text;
            stream.setMarkdown(text, 'external');
          }
        }
      } catch {

      }
    };
    void load();
    return () => { cancelled = true; };
  }, [adapter, id, stream]);

  
  const setFromEditor = useCallback((text: string) => stream.setMarkdown(text, 'editor' as MarkdownSource), [stream]);
  const setFromNodes = useCallback((text: string) => stream.setMarkdown(text, 'nodes' as MarkdownSource), [stream]);
  const getMarkdown = useCallback(() => stream.getMarkdown(), [stream]);
  const subscribe = useCallback((cb: (markdown: string, source: MarkdownSource) => void) => stream.subscribe(cb), [stream]);

  return {
    stream,
    setFromEditor,
    setFromNodes,
    getMarkdown,
    subscribe
  };
};

