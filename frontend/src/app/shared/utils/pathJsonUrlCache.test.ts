import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkspacePath,
  cleanWorkspacePath,
  extractParentPaths,
  extractWorkspaceId,
  parseWorkspacePath,
  resolveWorkspaceId,
} from './pathOperations';
import { getFileExtension, getFileNameWithoutExtension, normalizePath, sanitizeFileName } from './stringUtils';
import { buildMapUrl, getMapTargetFromUrl } from './mapUrl';
import { safeJsonParse, safeJsonParseWithDefault, safeJsonStringify, storeJson, parseStoredJson } from './safeJson';
import { LRUCache } from './lruCache';

describe('path, JSON, URL, and cache utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('normalizes file paths and workspace paths safely', () => {
    expect(normalizePath('//a///b//')).toBe('a/b');
    expect(normalizePath('..a..b..', '.')).toBe('a.b');
    expect(getFileNameWithoutExtension('topic.md')).toBe('topic');
    expect(getFileExtension('notes/topic.MD')).toBe('MD');
    expect(sanitizeFileName(' bad:/name?.md ')).toBe('bad__name_.md');
    expect(extractParentPaths('one/two/three')).toEqual(['one', 'one/two']);
    expect(buildWorkspacePath('ws_1', 'folder/map')).toBe('/ws_1/folder/map');
    expect(buildWorkspacePath('cloud', null)).toBe('/cloud');
  });

  it('recognizes only complete workspace path prefixes', () => {
    expect(extractWorkspaceId('/ws_abc/maps/a')).toBe('ws_abc');
    expect(extractWorkspaceId('/cloud/maps/a')).toBe('cloud');
    expect(extractWorkspaceId('/cloudy/maps/a')).toBeNull();
    expect(parseWorkspacePath('/ws_abc/maps/a')).toEqual({ workspaceId: 'ws_abc', relativePath: 'maps/a' });
    expect(parseWorkspacePath('/cloud')).toEqual({ workspaceId: 'cloud', relativePath: null });
    expect(cleanWorkspacePath('/group/a')).toBe('a');
    expect(resolveWorkspaceId('/plain/a', null, 'local')).toBe('local');
  });

  it('round-trips map query URLs and handles malformed hash encoding', () => {
    const location = { origin: 'https://example.test', pathname: '/Mindoodle/', search: '?x=1', hash: '#old' };
    const url = buildMapUrl(location, { mapId: 'folder/My Map.md', workspaceId: 'ws_1' });
    expect(url).toContain('map=folder%2FMy+Map');
    expect(url).toContain('workspace=ws_1');
    expect(url).not.toContain('#old');
    expect(getMapTargetFromUrl({ ...location, search: '?map=folder%2FMy+Map.md&workspace=ws_1', hash: '' })).toEqual({
      mapId: 'folder/My Map',
      workspaceId: 'ws_1',
    });
    expect(getMapTargetFromUrl({ ...location, search: '', hash: '#/map/folder%2Fchild.md?workspaceId=cloud' })).toEqual({
      mapId: 'folder/child',
      workspaceId: 'cloud',
    });
    expect(getMapTargetFromUrl({ ...location, search: '', hash: '#/map/%E0%A4%A' })).toBeNull();
  });

  it('returns safe results for valid, invalid, and circular JSON', () => {
    expect(safeJsonParse<{ value: number }>('{"value":1}')).toEqual({ success: true, data: { value: 1 } });
    expect(safeJsonParse('{broken').success).toBe(false);
    expect(safeJsonParseWithDefault('{broken', { value: 0 })).toEqual({ value: 0 });
    expect(safeJsonStringify({ value: 1 })).toEqual({ success: true, data: '{"value":1}' });
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(safeJsonStringify(circular).success).toBe(false);
    expect(storeJson('settings', { enabled: true })).toBe(true);
    expect(parseStoredJson('settings', { enabled: false })).toEqual({ enabled: true });
    expect(parseStoredJson('missing', { enabled: false })).toEqual({ enabled: false });
  });

  it('expires LRU entries even when they were inserted at time zero and evicts least-recently-used entries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const cache = new LRUCache<string, number>(2, 10);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    vi.advanceTimersByTime(11);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
