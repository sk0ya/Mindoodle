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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('AuthService sliding session renewal', () => {
  it('extends a session last renewed more than a day ago and stores it', async () => {
    const issued = new Date(Date.now() - 2 * DAY_MS).toISOString();
    const session = makeSession({
      createdAt: issued,
      renewedAt: issued,
      expiresAt: new Date(Date.now() + 28 * DAY_MS).toISOString()
    });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    const before = Date.now();
    const result = await auth.validateSession('tok-a');

    expect(result).not.toBeNull();
    expect(Date.parse(result?.expiresAt ?? '')).toBeGreaterThanOrEqual(before + THIRTY_DAYS_MS);
    expect(kv.put).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(kv.store.get('session:tok-a') ?? '{}') as UserSession;
    expect(stored.expiresAt).toBe(result?.expiresAt);
    expect(stored.renewedAt).toBe(result?.renewedAt);
    expect(stored.createdAt).toBe(issued);
  });

  it('renews a session issued before renewal existed, going by createdAt', async () => {
    const session = makeSession({
      createdAt: new Date(Date.now() - 29 * DAY_MS).toISOString(),
      expiresAt: new Date(Date.now() + DAY_MS).toISOString()
    });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    const result = await auth.validateSession('tok-a');

    expect(Date.parse(result?.expiresAt ?? '')).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it('does not write for a session renewed within the last day', async () => {
    const session = makeSession({ renewedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    const auth = new AuthService(kv.env);

    expect(await auth.validateSession('tok-a')).toEqual(session);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('writes at most once per token per day however often it is used', async () => {
    vi.useFakeTimers();
    const issued = new Date(Date.now() - 2 * DAY_MS).toISOString();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(makeSession({ createdAt: issued, renewedAt: issued })) });
    const auth = new AuthService(kv.env);

    // A busy day: a request every 30 seconds, long enough for the cache to
    // expire and the session to be re-read from KV many times.
    for (let elapsed = 0; elapsed < DAY_MS - 60_000; elapsed += 30_000) {
      expect(await auth.validateSession('tok-a')).not.toBeNull();
      vi.advanceTimersByTime(30_000);
    }

    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it('keeps an active user signed in past the original 30 days', async () => {
    vi.useFakeTimers();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(makeSession()) });
    const auth = new AuthService(kv.env);

    for (let day = 0; day < 45; day++) {
      expect(await auth.validateSession('tok-a')).not.toBeNull();
      vi.advanceTimersByTime(DAY_MS);
    }
  });

  it('still lets an idle session expire', async () => {
    vi.useFakeTimers();
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(makeSession()) });
    const auth = new AuthService(kv.env);

    vi.advanceTimersByTime(THIRTY_DAYS_MS + 1000);

    expect(await auth.validateSession('tok-a')).toBeNull();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('serves the request even when the renewal write fails', async () => {
    const issued = new Date(Date.now() - 2 * DAY_MS).toISOString();
    const session = makeSession({ createdAt: issued, renewedAt: issued });
    const kv = makeEnv({ 'session:tok-a': JSON.stringify(session) });
    kv.put.mockRejectedValueOnce(new Error('KV put() limit exceeded for the day.'));
    const auth = new AuthService(kv.env);

    const result = await auth.validateSession('tok-a');

    // The stored expiry did not move, so neither does the one reported.
    expect(result).toEqual(session);
  });
});

/** The pre-PBKDF2 format, computed independently of the code under test. */
async function legacyHash(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function userRecord(passwordHash: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 'user-1',
    email: 'user@example.com',
    passwordHash,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    ...overrides
  });
}

function storedUser(kv: ReturnType<typeof makeEnv>, key: string): { passwordHash: string; groupId?: string; lastLoginAt: string } {
  return JSON.parse(kv.store.get(key) ?? '{}');
}

describe('AuthService password hashing', () => {
  it('stores a salted, self-describing PBKDF2 hash', async () => {
    const auth = new AuthService(makeEnv().env);

    const hash = await auth.hashPassword('password123');

    expect(hash).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain('password123');
    // A random salt means equal passwords do not produce equal hashes.
    expect(await auth.hashPassword('password123')).not.toBe(hash);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const auth = new AuthService(makeEnv().env);
    const hash = await auth.hashPassword('password123');

    expect(await auth.verifyPassword('password123', hash)).toBe(true);
    expect(await auth.verifyPassword('password124', hash)).toBe(false);
  });

  it('still verifies legacy unsalted SHA-256 hashes', async () => {
    const auth = new AuthService(makeEnv().env);
    const hash = await legacyHash('password123');

    expect(await auth.verifyPassword('password123', hash)).toBe(true);
    expect(await auth.verifyPassword('password124', hash)).toBe(false);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    const auth = new AuthService(makeEnv().env);

    for (const hash of ['', 'pbkdf2$', 'pbkdf2$abc$AAAA$AAAA', 'pbkdf2$1000$!!!$AAAA', 'pbkdf2$1000$AAAA$', 'md5$x']) {
      expect(await auth.verifyPassword('password123', hash)).toBe(false);
    }
  });

  it('upgrades a legacy hash in both user records on a successful login', async () => {
    const kv = makeEnv({ 'user:user@example.com': userRecord(await legacyHash('password123')) });
    const auth = new AuthService(kv.env);

    expect((await auth.login('user@example.com', 'password123')).success).toBe(true);

    const byEmail = storedUser(kv, 'user:user@example.com');
    const byId = storedUser(kv, 'user_by_id:user-1');
    expect(byEmail.passwordHash).toMatch(/^pbkdf2\$100000\$/);
    expect(byId.passwordHash).toBe(byEmail.passwordHash);
    expect(await auth.verifyPassword('password123', byEmail.passwordHash)).toBe(true);
  });

  it('does not touch a legacy hash when the login fails', async () => {
    const hash = await legacyHash('password123');
    const kv = makeEnv({ 'user:user@example.com': userRecord(hash) });
    const auth = new AuthService(kv.env);

    expect((await auth.login('user@example.com', 'wrong-password')).success).toBe(false);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('re-hashes a PBKDF2 hash made with a different work factor', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('password123'), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1000 }, key, 256));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const kv = makeEnv({ 'user:user@example.com': userRecord(`pbkdf2$1000$${b64(salt)}$${b64(bits)}`) });
    const auth = new AuthService(kv.env);

    expect((await auth.login('user@example.com', 'password123')).success).toBe(true);
    expect(storedUser(kv, 'user:user@example.com').passwordHash).toMatch(/^pbkdf2\$100000\$/);
  });

  it('logs in a newly registered user', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);

    expect((await auth.register('user@example.com', 'password123')).success).toBe(true);
    expect(storedUser(kv, 'user:user@example.com').passwordHash).toMatch(/^pbkdf2\$/);
    expect((await auth.login('user@example.com', 'password123')).success).toBe(true);
  });
});

describe('AuthService.login KV writes', () => {
  const userWrites = (kv: ReturnType<typeof makeEnv>) =>
    kv.put.mock.calls.filter(([key]) => key.startsWith('user:') || key.startsWith('user_by_id:'));

  it('writes only the session when nothing about the user changed', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);
    kv.store.set('user:user@example.com', userRecord(await auth.hashPassword('password123')));

    expect((await auth.login('user@example.com', 'password123')).success).toBe(true);

    expect(userWrites(kv)).toHaveLength(0);
    expect(kv.put).toHaveBeenCalledTimes(1);
    expect(kv.put.mock.calls[0][0]).toMatch(/^session:/);
  });

  it('refreshes lastLoginAt once it is more than a day old', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);
    const stale = new Date(Date.now() - 2 * DAY_MS).toISOString();
    kv.store.set('user:user@example.com', userRecord(await auth.hashPassword('password123'), { lastLoginAt: stale }));

    await auth.login('user@example.com', 'password123');

    expect(userWrites(kv)).toHaveLength(2);
    expect(storedUser(kv, 'user:user@example.com').lastLoginAt).not.toBe(stale);
    expect(storedUser(kv, 'user_by_id:user-1').lastLoginAt).not.toBe(stale);
  });

  it('writes both records when a group code grants a new group', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);
    kv.store.set('user:user@example.com', userRecord(await auth.hashPassword('password123')));

    const result = await auth.login('user@example.com', 'password123', 'GroupCode');

    expect(result.user?.groupId).toBe('allowed-group');
    expect(storedUser(kv, 'user:user@example.com').groupId).toBe('allowed-group');
    expect(storedUser(kv, 'user_by_id:user-1').groupId).toBe('allowed-group');
  });

  it('does not rewrite the user for a group they already belong to', async () => {
    const kv = makeEnv();
    const auth = new AuthService(kv.env);
    kv.store.set('user:user@example.com', userRecord(await auth.hashPassword('password123'), { groupId: 'allowed-group' }));

    await auth.login('user@example.com', 'password123', 'GroupCode');

    expect(userWrites(kv)).toHaveLength(0);
  });

  it('rejects an unparseable user record instead of throwing', async () => {
    const kv = makeEnv({ 'user:user@example.com': 'not json' });
    const auth = new AuthService(kv.env);

    expect((await auth.login('user@example.com', 'password123')).success).toBe(false);
  });
});
