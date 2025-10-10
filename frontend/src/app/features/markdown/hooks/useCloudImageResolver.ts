import { useEffect } from 'react';
import { getLocalStorage, STORAGE_KEYS } from '@shared/utils';

export interface CloudImageResolverOptions {
  mapIdentifier?: { mapId: string; workspaceId?: string | null } | null;
  processedHtml: string;
  previewPaneRef: React.RefObject<HTMLDivElement>;
  cloudApiEndpoint: string;
}


export function useCloudImageResolver({
  mapIdentifier,
  processedHtml,
  previewPaneRef,
  cloudApiEndpoint,
}: CloudImageResolverOptions): void {
  useEffect(() => {
    const resolveCloudImages = async () => {
      try {
        if (!previewPaneRef.current) return;
        if (!mapIdentifier || mapIdentifier.workspaceId !== 'cloud') return;

        const container = previewPaneRef.current.querySelector('.markdown-preview');
        if (!container) return;

        const imgs = Array.from(container.querySelectorAll('img'));
        if (imgs.length === 0) return;

        const token = (() => {
          try {
            const res = getLocalStorage<string>(STORAGE_KEYS.AUTH_TOKEN);
            return res.success ? (res.data ?? null) : null;
          } catch {
            return null;
          }
        })();

        
        const parts = (mapIdentifier.mapId || '').split('/').filter(Boolean);
        const mapDir = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';

        for (const img of imgs) {
          try {
            if (!img || img.getAttribute('data-inline-loaded') === '1') continue;
            const src = img.getAttribute('src') || '';
            const lower = src.toLowerCase();
            if (!src || lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:')) {
              img.setAttribute('data-inline-loaded', '1');
              continue;
            }
            
            const rel = src.replace(/^\.\/*/, '');
            const cloudPath = `${mapDir}${rel}`.replace(/\/+/, '/');

            const url = `${cloudApiEndpoint}/api/images/${encodeURIComponent(cloudPath)}`;
            const res = await fetch(url, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!res.ok) {
              img.setAttribute('data-inline-loaded', '1');
              continue;
            }
            const json = (await res.json().catch(() => null)) as { data?: string; contentType?: string } | null;
            const base64 = json?.data;
            const ct = json?.contentType;
            if (base64 && ct) {
              img.src = `data:${ct};base64,${base64}`;
              img.setAttribute('data-inline-loaded', '1');
            } else {
              img.setAttribute('data-inline-loaded', '1');
            }
          } catch {
            
          }
        }
      } catch {
        
      }
    };
    
    setTimeout(resolveCloudImages, 0);
  }, [processedHtml, mapIdentifier, cloudApiEndpoint, previewPaneRef]);
}
