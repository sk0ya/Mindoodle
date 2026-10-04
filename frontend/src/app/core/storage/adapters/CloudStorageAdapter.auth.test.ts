import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CloudStorageAdapter,
  GroupCloudStorageAdapter,
  CLOUD_AUTH_EXPIRED_EVENT,
  GROUP_MEMBERSHIP_REQUIRED_MESSAGE,
  type CloudAuthExpiredDetail,
} from './CloudStorageAdapter';
import { MarkdownFolderAdapter } from './MarkdownFolderAdapter';
import { AdapterManager } from '../AdapterManager';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { STORAGE_KEYS } from '@shared/utils';
import { BASE_URL, createCloudBackend, type CloudBackend } from '../../../../test/cloudBackendMock';

interface User { id: string; email: string; groupId?: string }

const jsonResponse = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 401 ? 'Unauthorized' : 'OK',
  json: async () => body,
}) as unknown as Response;

const deferred = () => {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

/**
 * Wraps the in-memory backend with what the auth flow needs: a distinct token
 * per sign-in, tokens the server has revoked (401 on every route, as the real
 * Worker answers), overridable /api/auth/me and login users, and gates that
 * hold a reply back so tests can observe what happens before it arrives.
 */
const createAuthBackend = (options: { mapsPath?: string; imagesPath?: string } = {}) => {
  const backend: CloudBackend = createCloudBackend(options);
  const revoked = new Set<string>();
  const forbidden = new Set<string>();
  const gates = new Map<string, Promise<void>>();
  let tokenCounter = 0;
  let loginUser: User = { id: 'u1', email: 'a@b.c', groupId: 'g1' };
  let meUser: User | null = null;
  const sentAuth: Array<{ path: string; token: string | null }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = String(input).slice(BASE_URL.length);
    const header = new Headers(init?.headers).get('Authorization');
    const token = header ? header.replace(/^Bearer /, '') : null;
    sentAuth.push({ path, token });

    const gate = gates.get(path);
    if (gate) await gate;

    if (path === '/api/auth/login' || path === '/api/auth/register') {
      backend.requests.push({ method: 'POST', path });
      tokenCounter += 1;
      return jsonResponse({ success: true, token: `token-${tokenCounter}`, user: loginUser });
    }
    if (path === '/api/auth/logout') {
      backend.requests.push({ method: 'POST', path });
      if (token) revoked.add(token);
      return jsonResponse({ success: true });
    }
    if (token && revoked.has(token)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    if (path === '/api/auth/me' && meUser) {
      return jsonResponse({ success: true, user: meUser });
    }
    if (token && forbidden.has(token) && path.startsWith('/api/group/')) {
      return jsonResponse({ success: false, error: 'Group access required' }, 403);
    }
    return backend.fetchMock(input, init);
  });

  return {
    backend,
    fetchMock,
    sentAuth,
    revoke: (token: string) => revoked.add(token),
    forbid: (token: string) => forbidden.add(token),
    hold: (path: string) => {
      const d = deferred();
      gates.set(path, d.promise);
      return () => { gates.delete(path); d.release(); };
    },
    setLoginUser: (user: User) => { loginUser = user; },
    setMeUser: (user: User | null) => { meUser = user; },
  };
};

type AuthBackend = ReturnType<typeof createAuthBackend>;

const recordExpiredEvents = () => {
  const events: CloudAuthExpiredDetail[] = [];
  const listener = (event: Event) => {
    if (event instanceof CustomEvent) events.push(event.detail);
  };
  window.addEventListener(CLOUD_AUTH_EXPIRED_EVENT, listener);
  return { events, stop: () => window.removeEventListener(CLOUD_AUTH_EXPIRED_EVENT, listener) };
};

const resetWorkspaceService = () => {
  Reflect.set(WorkspaceService, 'instance', null);
};

/** Sign in, then register the workspace the way the auth modal's onSuccess does. */
const signInCloud = async (): Promise<CloudStorageAdapter> => {
  const adapter = new CloudStorageAdapter(BASE_URL);
  await adapter.login('a@b.c', 'password1');
  WorkspaceService.getInstance().addCloudWorkspace(adapter);
  return adapter;
};

const signInGroup = async (): Promise<GroupCloudStorageAdapter> => {
  const adapter = new GroupCloudStorageAdapter(BASE_URL);
  await adapter.login('a@b.c', 'password1', 'code');
  WorkspaceService.getInstance().addGroupWorkspace(adapter);
  return adapter;
};

describe('Cloud session rejected mid-session', () => {
  let auth: AuthBackend;
  let expired: ReturnType<typeof recordExpiredEvents>;

  beforeEach(() => {
    localStorage.clear();
    resetWorkspaceService();
    auth = createAuthBackend();
    vi.stubGlobal('fetch', auth.fetchMock);
    expired = recordExpiredEvents();
  });

  afterEach(() => {
    expired.stop();
    vi.unstubAllGlobals();
  });

  it('signs out, removes the workspace and announces it when a map request gets 401', async () => {
    const adapter = await signInCloud();
    const token = adapter.getAuthToken();
    expect(token).toBeTruthy();
    if (token) auth.revoke(token);

    // A refused listing is a failure, not an empty workspace.
    await expect(adapter.loadAllMaps()).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_USER)).toBeNull();
    expect(adapter.isAuthenticated).toBe(false);
    expect(adapter.getSessionEndReason()).toBe('expired');

    const workspaceService = WorkspaceService.getInstance();
    expect(workspaceService.getWorkspace('cloud')).toBeUndefined();
    expect(workspaceService.isCloudAuthenticated()).toBe(false);
    expect(expired.events).toEqual([{ workspaceId: 'cloud', reason: 'expired' }]);

    // The adapter stays reachable so the user can sign in again with it.
    const [ended] = workspaceService.takeEndedSessions();
    expect(ended?.adapter).toBe(adapter);
    expect(workspaceService.getCloudAdapter()).toBe(adapter);
  });

  it('reports a burst of refused requests once', async () => {
    const adapter = await signInCloud();
    const token = adapter.getAuthToken();
    if (token) auth.revoke(token);

    await Promise.allSettled([
      adapter.loadAllMaps(),
      adapter.getMapMarkdown?.({ mapId: 'A', workspaceId: 'cloud' }),
      adapter.deleteImageFile?.('images/x.png'),
    ]);

    expect(expired.events).toHaveLength(1);
  });

  it('ends only the refused workspace: the group session survives a cloud 401', async () => {
    const cloud = await signInCloud();
    const group = await signInGroup();
    expect(cloud.getAuthToken()).not.toBe(group.getAuthToken());
    const cloudToken = cloud.getAuthToken();
    if (cloudToken) auth.revoke(cloudToken);

    await expect(cloud.loadAllMaps()).rejects.toMatchObject({ status: 401 });

    const workspaceService = WorkspaceService.getInstance();
    expect(workspaceService.getWorkspace('cloud')).toBeUndefined();
    expect(workspaceService.getWorkspace('group')).toBeDefined();
    expect(workspaceService.isGroupAuthenticated()).toBe(true);
    expect(group.isAuthenticated).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(expired.events).toEqual([{ workspaceId: 'cloud', reason: 'expired' }]);
  });

  it('ends only the group workspace when the group token is refused', async () => {
    auth = createAuthBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', auth.fetchMock);
    const cloud = await signInCloud();
    const group = await signInGroup();
    const groupToken = group.getAuthToken();
    if (groupToken) auth.revoke(groupToken);

    await expect(group.loadAllMaps()).rejects.toMatchObject({ status: 401 });

    const workspaceService = WorkspaceService.getInstance();
    expect(workspaceService.getWorkspace('group')).toBeUndefined();
    expect(workspaceService.getWorkspace('cloud')).toBeDefined();
    expect(cloud.isAuthenticated).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeNull();
    expect(expired.events).toEqual([{ workspaceId: 'group', reason: 'expired' }]);
  });

  it('keeps the session on a 403 from a group route (no group access is not expiry)', async () => {
    auth = createAuthBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', auth.fetchMock);
    const group = await signInGroup();
    const token = group.getAuthToken();
    if (token) auth.forbid(token);

    await expect(group.loadAllMaps()).rejects.toMatchObject({ status: 403 });

    expect(group.isAuthenticated).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeTruthy();
    expect(WorkspaceService.getInstance().getWorkspace('group')).toBeDefined();
    expect(expired.events).toEqual([]);
  });

  it('signs out when an image upload gets 401, without retrying another route', async () => {
    const adapter = await signInCloud();
    const token = adapter.getAuthToken();
    if (token) auth.revoke(token);
    auth.sentAuth.length = 0;

    await expect(
      adapter.saveImageFile?.('images/a.png', new File(['x'], 'a.png', { type: 'image/png' }))
    ).rejects.toThrow();

    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeUndefined();
    expect(expired.events).toEqual([{ workspaceId: 'cloud', reason: 'expired' }]);
    expect(auth.sentAuth.map((r) => r.path)).toEqual(['/api/images/upload']);
  });

  it('ignores a refusal of a token a newer sign-in has replaced', async () => {
    const adapter = await signInCloud();
    const oldToken = adapter.getAuthToken();
    if (oldToken) auth.revoke(oldToken);

    const release = auth.hold('/api/maps');
    const staleLoad = adapter.loadAllMaps();
    await vi.waitFor(() => expect(auth.sentAuth.some((r) => r.path === '/api/maps')).toBe(true));

    await adapter.login('a@b.c', 'password1');
    const newToken = adapter.getAuthToken();
    release();
    await expect(staleLoad).rejects.toMatchObject({ status: 401 });

    expect(adapter.isAuthenticated).toBe(true);
    expect(adapter.getAuthToken()).toBe(newToken);
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBe(JSON.stringify(newToken));
    expect(expired.events).toEqual([]);
  });

  it('does not treat a wrong password as the end of the current session', async () => {
    const adapter = await signInCloud();
    auth.fetchMock.mockImplementationOnce(async () => jsonResponse({ success: false, error: 'Invalid credentials' }, 401));

    const result = await adapter.login('a@b.c', 'wrong-pass');

    expect(result.success).toBe(false);
    expect(adapter.isAuthenticated).toBe(true);
    expect(expired.events).toEqual([]);
  });
});

describe('Startup session restore', () => {
  let auth: AuthBackend;
  let expired: ReturnType<typeof recordExpiredEvents>;

  beforeEach(() => {
    localStorage.clear();
    resetWorkspaceService();
    auth = createAuthBackend();
    vi.stubGlobal('fetch', auth.fetchMock);
    expired = recordExpiredEvents();
  });

  afterEach(() => {
    expired.stop();
    vi.unstubAllGlobals();
  });

  const storeSession = (tokenKey: string, userKey: string, token: string, user: User) => {
    localStorage.setItem(tokenKey, JSON.stringify(token));
    localStorage.setItem(userKey, JSON.stringify(user));
  };

  it('shows the stored workspace before /api/auth/me answers', async () => {
    storeSession(STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_USER, 'stored', { id: 'u1', email: 'a@b.c' });
    const release = auth.hold('/api/auth/me');

    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.initialize();

    expect(adapter.isInitialized).toBe(true);
    expect(adapter.isAuthenticated).toBe(true);
    expect(WorkspaceService.getInstance().isCloudAuthenticated()).toBe(true);
    expect(auth.sentAuth.filter((r) => r.path === '/api/auth/me')).toHaveLength(1);

    release();
    expect(await adapter.waitForAuthVerification()).toBe('valid');
    expect(adapter.isAuthenticated).toBe(true);
  });

  it('removes the restored workspace and announces it when /me refuses the token', async () => {
    storeSession(STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_USER, 'stored', { id: 'u1', email: 'a@b.c' });
    auth.revoke('stored');
    const release = auth.hold('/api/auth/me');

    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.initialize();
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeDefined();

    release();
    expect(await adapter.waitForAuthVerification()).toBe('rejected');

    expect(adapter.isAuthenticated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeUndefined();
    expect(expired.events).toEqual([{ workspaceId: 'cloud', reason: 'expired' }]);
  });

  it('keeps the restored session when the backend is unavailable', async () => {
    storeSession(STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_USER, 'stored', { id: 'u1', email: 'a@b.c' });
    auth.backend.failAuthMe({ status: 503 });

    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.initialize();

    expect(await adapter.waitForAuthVerification()).toBe('unavailable');
    expect(adapter.isAuthenticated).toBe(true);
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeDefined();
    expect(expired.events).toEqual([]);
  });

  it('adopts the user /api/auth/me reports instead of the cached copy', async () => {
    storeSession(STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_USER, 'stored', { id: 'u1', email: 'old@b.c' });
    auth.setMeUser({ id: 'u1', email: 'new@b.c', groupId: 'g2' });

    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.initialize();
    await adapter.waitForAuthVerification();

    expect(adapter.getCurrentUser()).toEqual({ id: 'u1', email: 'new@b.c', groupId: 'g2' });
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_USER)).toBe(JSON.stringify({ id: 'u1', email: 'new@b.c', groupId: 'g2' }));
  });

  it('ends the group session when /me says the account has left the group', async () => {
    storeSession(STORAGE_KEYS.GROUP_AUTH_TOKEN, STORAGE_KEYS.GROUP_AUTH_USER, 'stored-group', { id: 'u1', email: 'a@b.c', groupId: 'g1' });
    auth.setMeUser({ id: 'u1', email: 'a@b.c' });

    const group = new GroupCloudStorageAdapter(BASE_URL);
    await group.initialize();
    expect(WorkspaceService.getInstance().getWorkspace('group')).toBeDefined();

    await group.waitForAuthVerification();

    expect(group.isAuthenticated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeNull();
    expect(WorkspaceService.getInstance().getWorkspace('group')).toBeUndefined();
    expect(expired.events).toEqual([{ workspaceId: 'group', reason: 'noGroupAccess' }]);
    // The useless token is also logged out on the server.
    expect(auth.sentAuth).toContainEqual({ path: '/api/auth/logout', token: 'stored-group' });
  });

  it('shows the group workspace once /me reports a membership the cached user lacked', async () => {
    storeSession(STORAGE_KEYS.GROUP_AUTH_TOKEN, STORAGE_KEYS.GROUP_AUTH_USER, 'stored-group', { id: 'u1', email: 'a@b.c' });
    auth.setMeUser({ id: 'u1', email: 'a@b.c', groupId: 'g1' });

    const group = new GroupCloudStorageAdapter(BASE_URL);
    await group.initialize();
    expect(WorkspaceService.getInstance().getWorkspace('group')).toBeUndefined();

    await group.waitForAuthVerification();

    expect(WorkspaceService.getInstance().isGroupAuthenticated()).toBe(true);
    expect(expired.events).toEqual([]);
  });

  it('AdapterManager returns before either session is verified and checks both at once', async () => {
    vi.spyOn(MarkdownFolderAdapter.prototype, 'initialize').mockResolvedValue();
    storeSession(STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_USER, 'stored', { id: 'u1', email: 'a@b.c' });
    storeSession(STORAGE_KEYS.GROUP_AUTH_TOKEN, STORAGE_KEYS.GROUP_AUTH_USER, 'stored-group', { id: 'u1', email: 'a@b.c', groupId: 'g1' });
    const release = auth.hold('/api/auth/me');

    const manager = new AdapterManager({ mode: 'local+cloud', cloudApiEndpoint: BASE_URL });
    await manager.initialize();

    const workspaces = await manager.getAvailableWorkspaces();
    expect(workspaces.map((w) => w.id)).toEqual(expect.arrayContaining(['cloud', 'group']));
    // Both checks are in flight together, neither waiting for the other.
    expect(auth.sentAuth.filter((r) => r.path === '/api/auth/me').map((r) => r.token))
      .toEqual(expect.arrayContaining(['stored', 'stored-group']));

    auth.revoke('stored');
    release();
    await WorkspaceService.getInstance().getCloudAdapter()?.waitForAuthVerification();
    await WorkspaceService.getInstance().getGroupAdapter()?.waitForAuthVerification();

    expect((await manager.getAvailableWorkspaces()).map((w) => w.id)).toEqual(['group']);
    expect(expired.events).toEqual([{ workspaceId: 'cloud', reason: 'expired' }]);
    vi.restoreAllMocks();
  });
});

describe('Group sign-in without a group', () => {
  let auth: AuthBackend;

  beforeEach(() => {
    localStorage.clear();
    resetWorkspaceService();
    auth = createAuthBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', auth.fetchMock);
    auth.setLoginUser({ id: 'u1', email: 'a@b.c' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['login', 'register'] as const)('%s fails, keeps nothing and logs the new session out', async (method) => {
    const group = new GroupCloudStorageAdapter(BASE_URL);

    const result = await group[method]('a@b.c', 'password1');

    expect(result).toEqual({ success: false, error: GROUP_MEMBERSHIP_REQUIRED_MESSAGE });
    expect(group.isAuthenticated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_USER)).toBeNull();
    expect(auth.sentAuth).toContainEqual({ path: '/api/auth/logout', token: 'token-1' });

    // A later startup has nothing to restore.
    const restarted = new GroupCloudStorageAdapter(BASE_URL);
    await restarted.initialize();
    expect(restarted.isAuthenticated).toBe(false);
  });

  it('is fine for the personal workspace, which needs no group', async () => {
    const cloud = new CloudStorageAdapter(BASE_URL);

    const result = await cloud.login('a@b.c', 'password1');

    expect(result.success).toBe(true);
    expect(cloud.isAuthenticated).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeTruthy();
  });
});
