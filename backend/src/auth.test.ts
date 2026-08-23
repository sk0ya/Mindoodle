import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AuthService as AuthServiceType } from './auth';
import type { Env, UserSession } from './types';

/**
 * These tests are about request *cost*, not just behaviour: the outage they
 * guard against was one KV read per authenticated request exhausting the daily
 * allowance, after which KV throws and every authenticated request fails.
 *
 * The session cache lives at module scope (one per isolate), so each test
 * re-imports the module to get a fresh one.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let AuthService: typeof AuthServiceType;

beforeEach(async () => {
  vi.resetModules();
  ({ AuthService } = await import('./auth'));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
    ...overrides
  };
}

function makeEnv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  });
  const del = vi.fn(async (key: string) => {
    store.delete(key);
  });

  const env = {
    USERS: { get, put, delete: del },
    MAPS_BUCKET: {},
    ALLOWED_EMAIL: 'user@example.com',
    ALLOWED_GROUP: 'GroupCode'
  } as unknown as Env;

  return { env, store, get, put, delete: del };
}

describe('AuthService.validateSession', () => {
  it('reads KV once for repeated requests carrying the same token', async () => {
    const session = makeSession();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    for (let i = 0; i < 25; i++) {
      expect(await auth.validateSession('tok-a')).toEqual(session);
    }

    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it('re-reads KV once the cache entry has aged out', async () => {
    vi.useFakeTimers();
    const session = makeSession();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    await auth.validateSession('tok-a');
    vi.advanceTimersByTime(61_000);
    await auth.validateSession('tok-a');

    expect(kv.get).toHaveBeenCalledTimes(2);
  });

  it('keeps separate verdicts per token', async () => {
    const a = makeSession({ userId: 'a', email: 'a@example.com' });
    const b = makeSession({ userId: 'b', email: 'b@example.com' });
    const kv = makeEnv({
      'session:tok-a': JSON.stringify(a),
      'session:tok-b': JSON.stringify(b)
    });
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toEqual(a);
    expect(await auth.validateSession('tok-b')).toEqual(b);
    expect(await auth.validateSession('tok-a')).toEqual(a);

    expect(kv.get).toHaveBeenCalledTimes(2);
  });

  it('does not hit KV again for a token it has just rejected', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('bogus')).toBeNull();
    expect(await auth.validateSession('bogus')).toBeNull();

    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it('lets a token that becomes valid shortly after a miss be accepted', async () => {
    vi.useFakeTimers();
    const kv = makeEnv();
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toBeNull();

    const session = makeSession();
    kv.store.set('session:tok-a', JSON.stringify(session));

    vi.advanceTimersByTime(6_000);
    expect(await auth.validateSession('tok-a')).toEqual(session);
  });

  it('stops accepting a token after logout', async () => {
    const session = makeSession();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toEqual(session);
    await auth.logout('tok-a');

    expect(await auth.validateSession('tok-a')).toBeNull();
    expect(kv.delete).toHaveBeenCalledWith('session:tok-a');
  });

  it('rejects an expired session and remembers the rejection', async () => {
    const expired = makeSession({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(expired) });
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toBeNull();
    expect(await auth.validateSession('tok-a')).toBeNull();

    expect(kv.get).toHaveBeenCalledTimes(1);
    expect(kv.delete).toHaveBeenCalledWith('session:tok-a');
  });

  it('never caches a session past its own expiry', async () => {
    vi.useFakeTimers();
    // Expires sooner than the cache TTL would otherwise keep it alive.
    const session = makeSession({ expiresAt: new Date(Date.now() + 10_000).toISOString() });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toEqual(session);

    vi.advanceTimersByTime(11_000);
    expect(await auth.validateSession('tok-a')).toBeNull();
  });

  it('treats a corrupt session record as invalid instead of throwing', async () => {
    const kv = makeEnv({ 'session:tok-a': 'not json' });
    const auth = new AuthService(kv.env);

    await expect(auth.validateSession('tok-a')).resolves.toBeNull();
  });

  it('does not touch KV for an empty token', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('')).toBeNull();
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('serves the session created by login without reading it back', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);
    const passwordHash = await auth.hashPassword('password123');
    kv.store.set('user:user@example.com', JSON.stringify({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }));

    const result = await auth.login('user@example.com', 'password123');
    expect(result.success).toBe(true);
    const token = result.token;
    if (!token) throw new Error('login did not return a token');

    kv.get.mockClear();
    const session = await auth.validateSession(token);
    expect(session?.email).toBe('user@example.com');
    expect(kv.get).not.toHaveBeenCalled();
  });
});
