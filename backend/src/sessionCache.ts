import type { UserSession } from './types';

/**
 * Per-isolate cache for validated bearer tokens.
 *
 * Every authenticated endpoint calls `AuthService.validateSession`, which reads
 * `session:{token}` from KV. With the app polling for remote edits every few
 * seconds, that is one KV read per poll per open tab, and the workspace ran out
 * of the daily KV read allowance — at which point KV throws and *every*
 * authenticated request fails, which the UI reports as an authentication error.
 *
 * A session is immutable for its whole 30-day lifetime, so re-reading it on
 * every request buys nothing. Caching it briefly turns a poll loop into roughly
 * one KV read per token per isolate per TTL.
 *
 * The cache lives in the isolate, so it is not authoritative: a token revoked
 * elsewhere can stay accepted by another isolate until its entry expires. The
 * TTL is therefore kept short, and `delete` clears the entry in the isolate
 * that handled the logout.
 */

interface CacheEntry {
  /** null records "this token is not a valid session" (negative caching). */
  session: UserSession | null;
  expiresAtMs: number;
}

/** How long a validated session is reused without re-reading KV. */
export const SESSION_CACHE_TTL_MS = 60_000;

/**
 * Unknown tokens are cached for much less time: they are what a stale client or
 * a probe sends repeatedly, but a token can also become valid moments later
 * (a login racing a request), so this must not linger.
 */
export const MISSING_SESSION_CACHE_TTL_MS = 5_000;

/** Upper bound on tracked tokens, so a flood of junk tokens cannot grow it. */
export const MAX_CACHED_SESSIONS = 1000;

export class SessionCache {
  private entries = new Map<string, CacheEntry>();

  constructor(
    // Resolved through the global on each call, so the clock a test (or a
    // runtime) installs later is the one that is actually used.
    private readonly now: () => number = () => Date.now(),
    private readonly maxEntries: number = MAX_CACHED_SESSIONS
  ) {}

  /**
   * Cached verdict for `token`, or `undefined` when nothing is known and the
   * caller has to consult KV. A cached verdict of `null` means "not a valid
   * session" and is itself an answer.
   */
  get(token: string): UserSession | null | undefined {
    const entry = this.entries.get(token);
    if (!entry) return undefined;

    if (this.now() >= entry.expiresAtMs) {
      this.entries.delete(token);
      return undefined;
    }

    // Refresh recency without extending the entry's lifetime.
    this.entries.delete(token);
    this.entries.set(token, entry);
    return entry.session;
  }

  /** Remember a session that KV confirmed. */
  set(token: string, session: UserSession): void {
    const sessionExpiry = Date.parse(session.expiresAt);
    // Never let a cached entry outlive the session it describes.
    const expiresAtMs = Number.isFinite(sessionExpiry)
      ? Math.min(this.now() + SESSION_CACHE_TTL_MS, sessionExpiry)
      : this.now() + SESSION_CACHE_TTL_MS;

    this.store(token, { session, expiresAtMs });
  }

  /** Remember that `token` did not resolve to a usable session. */
  setMissing(token: string): void {
    this.store(token, { session: null, expiresAtMs: this.now() + MISSING_SESSION_CACHE_TTL_MS });
  }

  delete(token: string): void {
    this.entries.delete(token);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private store(token: string, entry: CacheEntry): void {
    this.entries.delete(token);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(token, entry);
  }
}
