import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, localStorageManager } from './localStorage';

describe('localStorage manager', () => {
  beforeEach(() => localStorage.clear());

  it('stores, reads, removes, and lists namespaced values', () => {
    expect(localStorageManager.setItem(STORAGE_KEYS.APP_SETTINGS, { theme: 'dark' })).toEqual({
      success: true,
      data: { theme: 'dark' },
    });
    expect(localStorageManager.getItem(STORAGE_KEYS.APP_SETTINGS)).toEqual({ success: true, data: { theme: 'dark' } });
    localStorage.setItem('mindflow_other', '1');
    expect(localStorageManager.getKeysWithPrefix('mindflow_')).toEqual(expect.arrayContaining([
      STORAGE_KEYS.APP_SETTINGS,
      'mindflow_other',
    ]));
    expect(localStorageManager.removeItem(STORAGE_KEYS.APP_SETTINGS).success).toBe(true);
    expect(localStorageManager.getItem(STORAGE_KEYS.APP_SETTINGS, { theme: 'light' })).toEqual({ success: true, data: { theme: 'light' } });
    expect(localStorageManager.removeItems([STORAGE_KEYS.APP_SETTINGS, STORAGE_KEYS.STORAGE_MODE]).success).toBe(true);
  });

  it('returns defaults and errors for missing or malformed values', () => {
    expect(localStorageManager.getItem(STORAGE_KEYS.APP_SETTINGS, { ready: false })).toEqual({ success: true, data: { ready: false } });
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, '{bad');
    expect(localStorageManager.getItem(STORAGE_KEYS.APP_SETTINGS, { ready: false })).toMatchObject({
      success: false,
      data: { ready: false },
    });

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(localStorageManager.setItem(STORAGE_KEYS.APP_SETTINGS, circular).success).toBe(false);
  });
});
