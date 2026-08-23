import { describe, expect, it } from 'vitest';
import {
  MAX_CACHED_SESSIONS,
  MISSING_SESSION_CACHE_TTL_MS,
  SESSION_CACHE_TTL_MS,
  SessionCache
} from './sessionCache';
import type { UserSession } from './types';

function makeSession(expiresInMs = 30 * 24 * 60 * 60 * 1000, at = 0): UserSession {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    createdAt: new Date(at).toISOString(),
    expiresAt: new Date(at + expiresInMs).toISOString()
  };
}

/** A cache with a clock the test drives directly. */
function makeCache(maxEntries = MAX_CACHED_SESSIONS) {
  let now = 0;
  const cache = new SessionCache(() => now, maxEntries);
  return {
    cache,
    advance(ms: number) {
      now += ms;
    }
  };
}

describe('SessionCache', () => {
  it('reports a miss for a token it has never seen', () => {
    const { cache } = makeCache();
    expect(cache.get('tok')).toBeUndefined();
  });

  it('distinguishes "unknown" from "known to be invalid"', () => {
    const { cache } = makeCache();
    cache.setMissing('tok');

    // undefined means "ask KV"; null means "KV already said no".
    expect(cache.get('tok')).toBeNull();
    expect(cache.get('other')).toBeUndefined();
  });

  it('serves a stored session until the TTL elapses', () => {
    const { cache, advance } = makeCache();
    const session = makeSession();
    cache.set('tok', session);

    advance(SESSION_CACHE_TTL_MS - 1);
    expect(cache.get('tok')).toEqual(session);

    advance(2);
    expect(cache.get('tok')).toBeUndefined();
  });

  it('expires a negative entry much sooner than a positive one', () => {
    const { cache, advance } = makeCache();
    cache.setMissing('tok');

    advance(MISSING_SESSION_CACHE_TTL_MS + 1);
    expect(cache.get('tok')).toBeUndefined();
  });

  it('never serves a session beyond its own expiry', () => {
    const { cache, advance } = makeCache();
    cache.set('tok', makeSession(SESSION_CACHE_TTL_MS / 2));

    advance(SESSION_CACHE_TTL_MS / 2 + 1);
    expect(cache.get('tok')).toBeUndefined();
  });

  it('falls back to the TTL when the session carries an unusable expiry', () => {
    const { cache, advance } = makeCache();
    const session = { ...makeSession(), expiresAt: 'not a date' };
    cache.set('tok', session);

    expect(cache.get('tok')).toEqual(session);
    advance(SESSION_CACHE_TTL_MS + 1);
    expect(cache.get('tok')).toBeUndefined();
  });

  it('does not extend an entry lifetime by reading it', () => {
    const { cache, advance } = makeCache();
    cache.set('tok', makeSession());

    advance(SESSION_CACHE_TTL_MS - 10);
    expect(cache.get('tok')).not.toBeUndefined();

    advance(20);
    expect(cache.get('tok')).toBeUndefined();
  });

  it('forgets a token on delete', () => {
    const { cache } = makeCache();
    cache.set('tok', makeSession());
    cache.delete('tok');

    expect(cache.get('tok')).toBeUndefined();
  });

  it('drops the oldest entries rather than growing without bound', () => {
    const { cache } = makeCache(3);
    cache.set('a', makeSession());
    cache.set('b', makeSession());
    cache.set('c', makeSession());
    cache.set('d', makeSession());

    expect(cache.size).toBeLessThanOrEqual(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).not.toBeUndefined();
  });

  it('keeps recently used entries when evicting', () => {
    const { cache } = makeCache(3);
    cache.set('a', makeSession());
    cache.set('b', makeSession());
    cache.set('c', makeSession());

    // Touching 'a' makes 'b' the least recently used.
    expect(cache.get('a')).not.toBeUndefined();
    cache.set('d', makeSession());

    expect(cache.get('a')).not.toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('replaces an existing entry instead of duplicating it', () => {
    const { cache } = makeCache();
    cache.setMissing('tok');
    const session = makeSession();
    cache.set('tok', session);

    expect(cache.get('tok')).toEqual(session);
    expect(cache.size).toBe(1);
  });

  it('empties on clear', () => {
    const { cache } = makeCache();
    cache.set('a', makeSession());
    cache.set('b', makeSession());
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
