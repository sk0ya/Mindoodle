import { beforeEach, describe, expect, it } from 'vitest';
import { getLocalStorage, STORAGE_KEYS } from '@core/storage/localStorage';
import { useMindMapStore } from '../mindMapStore';

describe('settings persistence integration', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useMindMapStore.getState();
    store.cancelPendingCommit();
    store.resetSettings();
  });

  it('updates and persists settings without losing unrelated defaults', () => {
    const store = useMindMapStore.getState();
    store.updateSetting('theme', 'light');
    store.saveSettingsToStorage();

    expect(useMindMapStore.getState().settings.theme).toBe('light');
    const saved = getLocalStorage<Record<string, unknown>>(STORAGE_KEYS.APP_SETTINGS, {});
    expect(saved.data?.theme).toBe('light');
    expect(saved.data?.fontSize).toBe(14);
  });

  it('loads explicit current Vim settings', () => {
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify({
      vimMindMap: true,
      vimEditor: false,
    }));

    useMindMapStore.getState().loadSettingsFromStorage();

    expect(useMindMapStore.getState().settings.vimMindMap).toBe(true);
    expect(useMindMapStore.getState().settings.vimEditor).toBe(false);
  });

  it('replaces the known obsolete cloud endpoint with the current endpoint', () => {
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify({
      cloudApiEndpoint: 'https://mindoodle-backend.your-subdomain.workers.dev',
    }));

    useMindMapStore.getState().loadSettingsFromStorage();

    expect(useMindMapStore.getState().settings.cloudApiEndpoint)
      .toBe('https://mindoodle-backend-production.shigekazukoya.workers.dev');
  });
});
