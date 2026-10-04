import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statusMessages } from '@shared/utils';
import { CloudMapDestinationExistsError } from '@core/storage/adapters/CloudStorageAdapter';
import { MAP_LIST_POLL_INTERVAL_MS, RETURN_REFRESH_MIN_GAP_MS, useMindMapEvents } from './useMindMapEvents';

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

describe('useMindMapEvents map list polling', () => {
  let refreshMapList: ReturnType<typeof vi.fn>;

  const renderEvents = (extra: Record<string, unknown> = {}) =>
    renderHook(() => useMindMapEvents({
      mindMap: { refreshMapList, ...extra },
      selectMapById: async () => true,
    }));

  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
    refreshMapList = vi.fn(async () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setHidden(false);
  });

  it('polls in the background while visible', () => {
    renderEvents();

    act(() => { vi.advanceTimersByTime(MAP_LIST_POLL_INTERVAL_MS * 3); });

    expect(refreshMapList).toHaveBeenCalledTimes(3);
    expect(refreshMapList).toHaveBeenCalledWith({ background: true });
  });

  it('does not poll at all while the tab is hidden', () => {
    renderEvents();
    setHidden(true);

    act(() => { vi.advanceTimersByTime(MAP_LIST_POLL_INTERVAL_MS * 10); });

    expect(refreshMapList).not.toHaveBeenCalled();
  });

  it('refreshes once when the tab is shown again, however many events announce it', () => {
    renderEvents();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });

    const explicit = refreshMapList.mock.calls.filter(([options]) => !options?.background);
    expect(explicit).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(RETURN_REFRESH_MIN_GAP_MS + 1); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(refreshMapList.mock.calls.filter(([options]) => !options?.background)).toHaveLength(2);
  });

  it('tells the user why a rename failed, e.g. the name is taken', async () => {
    const errors = vi.spyOn(statusMessages, 'customError');
    const renameItem = vi.fn(async () => { throw new CloudMapDestinationExistsError('Notes/Beta'); });
    const refreshes: Event[] = [];
    const onRefresh = (event: Event) => refreshes.push(event);
    window.addEventListener('mindoodle:refreshExplorer', onRefresh);
    renderEvents({ renameItem });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('mindoodle:renameItem', { detail: { oldPath: '/cloud/Notes/Alpha.md', newName: 'Beta' } }));
      await Promise.resolve();
    });
    window.removeEventListener('mindoodle:refreshExplorer', onRefresh);

    expect(renameItem).toHaveBeenCalledWith('/cloud/Notes/Alpha.md', 'Beta');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0][0]).toContain('Notes/Beta');
    expect(refreshes).toHaveLength(0);
  });
});
