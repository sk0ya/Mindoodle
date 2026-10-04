import type { Env, User, UserSession, AuthRequest, AuthResponse } from './types';
import { SessionCache } from './sessionCache';

/**
 * Shared by every request this isolate handles, which is the point: it is what
 * keeps a polling client from spending one KV read per request. See
 * sessionCache.ts for why that matters.
 */
const sessionCache = new SessionCache();

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a session stays valid after it was issued or last renewed. */
export const SESSION_TTL_MS = 30 * DAY_MS;

/**
 * An active session's expiry is pushed forward at most this often. Renewing on
 * every request would turn each cache miss into a KV write, and the free tier
 * allows only 1000 writes a day; once a day per token keeps an active user
 * signed in indefinitely for one write.
 */
export const SESSION_RENEWAL_INTERVAL_MS = DAY_MS;

/**
 * `lastLoginAt` is informational, so refreshing it is not worth two KV writes
 * on every login; it is kept accurate to about a day.
 */
const LAST_LOGIN_REFRESH_MS = DAY_MS;

/**
 * PBKDF2-SHA256 work factor. 100000 is the most Cloudflare's WebCrypto accepts,
 * and each verification costs tens of milliseconds of Worker CPU time; that
 * cost is paid only on register and login, never on authenticated requests.
 * Stored hashes record their own count, so changing this re-hashes users on
 * their next login rather than locking them out.
 */
export const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BITS = 256;
const PBKDF2_PREFIX = 'pbkdf2';

/** The original format: unsalted SHA-256 as 64 hex digits. */
const LEGACY_SHA256_HASH = /^[0-9a-f]{64}$/i;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Compares in time independent of where the inputs first differ. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, PBKDF2_HASH_BITS);
  return new Uint8Array(bits);
}

async function legacySha256Hex(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function isOlderThan(timestamp: string | undefined, ageMs: number, nowMs: number): boolean {
  const parsed = timestamp ? Date.parse(timestamp) : NaN;
  // An unreadable timestamp is treated as stale so it gets rewritten.
  return !Number.isFinite(parsed) || nowMs - parsed >= ageMs;
}

export class AuthService {
  constructor(private env: Env) {}

  /** `pbkdf2$<iterations>$<saltB64>$<hashB64>`, so the work factor can change later. */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    return [PBKDF2_PREFIX, PBKDF2_ITERATIONS, toBase64(salt), toBase64(hash)].join('$');
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const encoder = new TextEncoder();

    if (LEGACY_SHA256_HASH.test(storedHash)) {
      const candidate = await legacySha256Hex(password);
      return timingSafeEqual(encoder.encode(candidate), encoder.encode(storedHash.toLowerCase()));
    }

    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) return false;
    const iterations = Number(parts[1]);
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    if (!Number.isInteger(iterations) || iterations <= 0 || !salt || !expected || expected.length === 0) {
      return false;
    }

    const candidate = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(candidate, expected);
  }

  /** True for legacy SHA-256 hashes and for PBKDF2 hashes at another work factor. */
  needsRehash(storedHash: string): boolean {
    const parts = storedHash.split('$');
    return parts[0] !== PBKDF2_PREFIX || Number(parts[1]) !== PBKDF2_ITERATIONS;
  }

  generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  generateUserId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private getAllowedGroupId(groupCode?: string): string | undefined {
    const allowedGroup = this.env.ALLOWED_GROUP;
    return allowedGroup && groupCode === allowedGroup ? 'allowed-group' : undefined;
  }

  async isEmailAllowed(email: string, groupCode?: string): Promise<boolean> {
    if (email === this.env.ALLOWED_EMAIL) {
      return true;
    }

    return !!this.getAllowedGroupId(groupCode);
  }

  async register(email: string, password: string, groupCode?: string): Promise<AuthResponse> {
    if (!await this.isEmailAllowed(email, groupCode)) {
      return {
        success: false,
        error: 'Registration requires an authorized email or group code'
      };
    }

    // Check if user already exists
    const existingUser = await this.env.USERS.get(`user:${email}`);
    if (existingUser) {
      return {
        success: false,
        error: 'User already exists'
      };
    }

    const userId = this.generateUserId();
    const passwordHash = await this.hashPassword(password);
    const groupId = this.getAllowedGroupId(groupCode);
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      email,
      passwordHash,
      ...(groupId ? { groupId } : {}),
      createdAt: now,
      lastLoginAt: now
    };

    await this.env.USERS.put(`user:${email}`, JSON.stringify(user));
    await this.env.USERS.put(`user_by_id:${userId}`, JSON.stringify(user));

    const token = this.generateToken();
    const session: UserSession = {
      userId,
      email,
      ...(groupId ? { groupId } : {}),
      createdAt: now,
      renewedAt: now,
      expiresAt: new Date(Date.parse(now) + SESSION_TTL_MS).toISOString()
    };

    await this.env.USERS.put(`session:${token}`, JSON.stringify(session));
    sessionCache.set(token, session);

    return {
      success: true,
      token,
      user: {
        id: userId,
        email,
        ...(groupId ? { groupId } : {})
      }
    };
  }

  async login(email: string, password: string, groupCode?: string): Promise<AuthResponse> {
    const userStr = await this.env.USERS.get(`user:${email}`);
    if (!userStr) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    let user: User;
    try {
      user = JSON.parse(userStr) as User;
    } catch (error) {
      console.error('Unparseable user record:', error);
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }
    const isValidPassword = await this.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    const nextGroupId = this.getAllowedGroupId(groupCode);

    if (groupCode && !nextGroupId) {
      return {
        success: false,
        error: 'Invalid group code'
      };
    }

    // Each login used to rewrite both user records just to bump lastLoginAt,
    // two KV writes against a 1000-a-day allowance. Write only when the record
    // materially changes, or when lastLoginAt has gone noticeably stale.
    let userChanged = false;

    if (nextGroupId && user.groupId !== nextGroupId) {
      user.groupId = nextGroupId;
      userChanged = true;
    }

    // The password is in hand only now, so this is the one chance to move a
    // legacy (unsalted SHA-256) or outdated hash to the current format.
    if (this.needsRehash(user.passwordHash)) {
      user.passwordHash = await this.hashPassword(password);
      userChanged = true;
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    if (userChanged || isOlderThan(user.lastLoginAt, LAST_LOGIN_REFRESH_MS, nowMs)) {
      user.lastLoginAt = now;
      await this.env.USERS.put(`user:${email}`, JSON.stringify(user));
      await this.env.USERS.put(`user_by_id:${user.id}`, JSON.stringify(user));
    }

    const token = this.generateToken();
    const session: UserSession = {
      userId: user.id,
      email: user.email,
      ...(user.groupId ? { groupId: user.groupId } : {}),
      createdAt: now,
      renewedAt: now,
      expiresAt: new Date(nowMs + SESSION_TTL_MS).toISOString()
    };

    await this.env.USERS.put(`session:${token}`, JSON.stringify(session));
    sessionCache.set(token, session);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        ...(user.groupId ? { groupId: user.groupId } : {})
      }
    };
  }

  async validateSession(token: string): Promise<UserSession | null> {
    if (!token) return null;

    const cached = sessionCache.get(token);
    if (cached !== undefined) return cached;

    const sessionStr = await this.env.USERS.get(`session:${token}`);
    if (!sessionStr) {
      sessionCache.setMissing(token);
      return null;
    }

    let session: UserSession;
    try {
      session = JSON.parse(sessionStr) as UserSession;
    } catch (error) {
      // A corrupt record is not a session; treating it as one would throw on
      // every request that presents this token.
      console.error('Discarding unparseable session record:', error);
      sessionCache.setMissing(token);
      return null;
    }

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      sessionCache.setMissing(token);
      await this.env.USERS.delete(`session:${token}`);
      return null;
    }

    const current = await this.renewIfDue(token, session);
    sessionCache.set(token, current);
    return current;
  }

  /**
   * Sliding expiry: a fixed 30 days cut active users off mid-work. Renewal is
   * only checked when the session is read from KV, which the per-isolate cache
   * limits to about once a minute, and only written once a day per token.
   *
   * The renewal is best-effort. A failed write (most likely the daily KV write
   * allowance) leaves the session valid until its existing expiry, so it must
   * not fail the request that happened to trigger it.
   */
  private async renewIfDue(token: string, session: UserSession): Promise<UserSession> {
    const nowMs = Date.now();
    if (!isOlderThan(session.renewedAt ?? session.createdAt, SESSION_RENEWAL_INTERVAL_MS, nowMs)) {
      return session;
    }

    const renewed: UserSession = {
      ...session,
      renewedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + SESSION_TTL_MS).toISOString()
    };

    try {
      await this.env.USERS.put(`session:${token}`, JSON.stringify(renewed));
      return renewed;
    } catch (error) {
      console.error('Session renewal failed; keeping the current expiry:', error);
      return session;
    }
  }

  async logout(token: string): Promise<void> {
    if (token) {
      // Drop the cached verdict first: the KV delete may fail, but a token the
      // user asked to revoke must not keep being served from this isolate.
      sessionCache.delete(token);
      await this.env.USERS.delete(`session:${token}`);
    }
  }
}
