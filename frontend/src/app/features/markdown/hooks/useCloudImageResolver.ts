import { useEffect } from 'react';
import { getLocalStorage, STORAGE_KEYS } from '@shared/utils';
import { cloudImageKey, clearCloudImageFailures, getCachedCloudImage, resolveCloudImage } from './cloudImageCache';

export interface CloudImageResolverOptions {
  mapIdentifier?: { mapId: string; workspaceId?: string | null } | null;
  processedHtml: string;
  previewPaneRef: React.RefObject<HTMLDivElement>;
  cloudApiEndpoint: string;
}

/** Images already inlined by a previous pass are marked with this attribute. */
const LOADED_ATTR = 'data-inline-loaded';

/** Credentials the cache's remembered failures were produced under. */
const lastSeenToken = new Map<string, string | null>();

/**
 * Signing in (or refreshing an expired session) makes previously failed images
 * loadable again, so stop suppressing their retries.
 */
function noteCredentials(workspaceId: string, token: string | null): void {
  if (lastSeenToken.has(workspaceId) && lastSeenToken.get(workspaceId) !== token) {
    clearCloudImageFailures();
  }
  lastSeenToken.set(workspaceId, token);
}

/** Fetch one image and turn it into a `data:` URL, or null when unavailable. */
async function fetchCloudImage(url: string, token: string | null): Promise<string | null> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as { data?: string; contentType?: string } | null;
  return json?.data && json?.contentType ? `data:${json.contentType};base64,${json.data}` : null;
}

export function useCloudImageResolver({
  mapIdentifier,
  processedHtml,
  previewPaneRef,
  cloudApiEndpoint,
}: CloudImageResolverOptions): void {
  useEffect(() => {
    let cancelled = false;

    const resolveCloudImages = async () => {
      try {
        if (cancelled || !previewPaneRef.current) return;

        const workspaceId = mapIdentifier?.workspaceId;
        if (!mapIdentifier || (workspaceId !== 'cloud' && workspaceId !== 'group')) return;

        const container = previewPaneRef.current.querySelector('.markdown-preview');
        if (!container) return;

        const imgs = Array.from(container.querySelectorAll('img'));
        if (imgs.length === 0) return;

        const token = (() => {
          try {
            const key = workspaceId === 'group'
              ? STORAGE_KEYS.GROUP_AUTH_TOKEN
              : STORAGE_KEYS.AUTH_TOKEN;
            const res = getLocalStorage<string>(key);
            return res.success ? (res.data ?? null) : null;
          } catch {
            return null;
          }
        })();

        noteCredentials(workspaceId, token);

        const parts = (mapIdentifier.mapId || '').split('/').filter(Boolean);
        const mapDir = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';
        const imageEndpoint = workspaceId === 'group' ? '/api/group/images' : '/api/images';

        const inline = (img: HTMLImageElement, dataUrl: string | null): void => {
          if (dataUrl) img.src = dataUrl;
          img.setAttribute(LOADED_ATTR, '1');
        };

        const pending: Array<Promise<void>> = [];

        for (const img of imgs) {
          if (!img || img.getAttribute(LOADED_ATTR) === '1') continue;

          const src = img.getAttribute('src') || '';
          const lower = src.toLowerCase();
          if (!src || lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:')) {
            img.setAttribute(LOADED_ATTR, '1');
            continue;
          }

          const rel = src.replace(/^\.\/*/, '');
          const cloudPath = `${mapDir}${rel}`.replace(/\/+/, '/');
          const key = cloudImageKey(workspaceId, cloudPath);

          // The preview re-renders (and loses the marker) on every keystroke,
          // so serve known images straight from the cache without a request.
          const cached = getCachedCloudImage(key);
          if (cached !== undefined) {
            inline(img, cached);
            continue;
          }

          const url = `${cloudApiEndpoint}${imageEndpoint}/${encodeURIComponent(cloudPath)}`;
          pending.push(
            resolveCloudImage(key, () => fetchCloudImage(url, token))
              .then((dataUrl) => {
                if (!cancelled) inline(img, dataUrl);
              })
              .catch(() => {
                if (!cancelled) img.setAttribute(LOADED_ATTR, '1');
              })
          );
        }

        // Images are independent; loading them in sequence only delayed the
        // preview by the sum of the round trips.
        await Promise.all(pending);
      } catch {

      }
    };

    const timer = setTimeout(resolveCloudImages, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [processedHtml, mapIdentifier, cloudApiEndpoint, previewPaneRef]);
}
