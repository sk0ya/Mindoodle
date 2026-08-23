import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useCloudImageResolver } from './useCloudImageResolver';
import { clearCloudImageCache, FAILURE_TTL_MS } from './cloudImageCache';
import { STORAGE_KEYS } from '@shared/utils';

const ENDPOINT = 'https://backend.test';

const Preview: React.FC<{ html: string; mapId: string }> = ({ html, mapId }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useCloudImageResolver({
    mapIdentifier: { mapId, workspaceId: 'cloud' },
    processedHtml: html,
    previewPaneRef: ref,
    cloudApiEndpoint: ENDPOINT,
  });

  return (
    <div ref={ref}>
      {/* The preview is re-rendered from HTML on every keystroke, which is why
          per-element markers cannot be relied on as a cache. */}
      <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

const imageResponse = (data: string) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ data, contentType: 'image/png' }),
}) as unknown as Response;

describe('useCloudImageResolver', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearCloudImageCache();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, JSON.stringify('token-1'));
    fetchMock = vi.fn(async () => imageResponse('AAAA'));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCloudImageCache();
  });

  const html = (caption: string) => `<p>${caption}</p><img src="./assets/logo.png" alt="logo" />`;

  it('inlines a relative image once', async () => {
    const { container } = render(<Preview html={html('a')} mapId="Notes/Alpha" />);

    await waitFor(() => {
      expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${ENDPOINT}/api/images/${encodeURIComponent('Notes/assets/logo.png')}`
    );
  });

  it('does not re-fetch when the preview re-renders', async () => {
    const { container, rerender } = render(<Preview html={html('a')} mapId="Notes/Alpha" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Each keystroke replaces the preview DOM, so the img element is new.
    for (const caption of ['ab', 'abc', 'abcd']) {
      rerender(<Preview html={html(caption)} mapId="Notes/Alpha" />);
      await waitFor(() => {
        expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests an image only once when several copies appear in one document', async () => {
    const doc = '<div class="x"><img src="./a.png" /><img src="./a.png" /><img src="./a.png" /></div>';
    render(<Preview html={doc} mapId="Alpha" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('remembers an image the backend cannot return instead of retrying every render', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as unknown as Response);

    const { rerender } = render(<Preview html={html('a')} mapId="Notes/Alpha" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<Preview html={html('ab')} mapId="Notes/Alpha" />);
    rerender(<Preview html={html('abc')} mapId="Notes/Alpha" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('retries a failed image once the suppression window expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error', json: async () => ({}) } as unknown as Response);

      const { container, rerender } = render(<Preview html={html('a')} mapId="Notes/Alpha" />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      vi.setSystemTime(Date.now() + FAILURE_TTL_MS + 1);
      rerender(<Preview html={html('ab')} mapId="Notes/Alpha" />);

      await waitFor(() => {
        expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries failed images immediately after the session token changes', async () => {
    // A stale token: every image comes back 401.
    fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) } as unknown as Response);

    const { container, rerender } = render(<Preview html={html('a')} mapId="Notes/Alpha" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // The user signs in again; the preview must not stay broken.
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, JSON.stringify('token-2'));
    fetchMock.mockResolvedValue(imageResponse('AAAA'));
    rerender(<Preview html={html('ab')} mapId="Notes/Alpha" />);

    await waitFor(() => {
      expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    });
  });

  it('leaves absolute and data URLs untouched', async () => {
    const doc = '<img src="https://example.com/a.png" /><img src="data:image/png;base64,ZZZ" />';
    const { container } = render(<Preview html={doc} mapId="Alpha" />);

    await waitFor(() => {
      expect(container.querySelectorAll('img[data-inline-loaded="1"]')).toHaveLength(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes no request for a local workspace', async () => {
    const LocalPreview: React.FC = () => {
      const ref = React.useRef<HTMLDivElement>(null);
      useCloudImageResolver({
        mapIdentifier: { mapId: 'Alpha', workspaceId: 'ws-local' },
        processedHtml: html('a'),
        previewPaneRef: ref,
        cloudApiEndpoint: ENDPOINT,
      });
      return <div ref={ref}><div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html('a') }} /></div>;
    };

    render(<LocalPreview />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
