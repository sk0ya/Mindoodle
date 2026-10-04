import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MindMapController } from './MindMapController';
import { CloudStorageAdapter, GroupCloudStorageAdapter } from '@core/storage/adapters/CloudStorageAdapter';
import { WorkspaceService } from '@shared/services/WorkspaceService';
import { BASE_URL, createCloudBackend, type CloudBackend } from '../../../../test/cloudBackendMock';

const unauthorized = (): Response => ({
  ok: false,
  status: 401,
  statusText: 'Unauthorized',
  json: async () => ({ success: false, error: 'Unauthorized' }),
}) as unknown as Response;

/** The modal state exactly as useMindMapModals holds it: real React state setters. */
const renderModalState = () => renderHook(() => {
  const [adapter, setAuthCloudAdapter] = useState<CloudStorageAdapter | null>(null);
  const [onSuccess, setAuthOnSuccess] = useState<((a: CloudStorageAdapter) => void) | null>(null);
  const [open, setIsAuthModalOpen] = useState(false);
  return { adapter, onSuccess, open, handlers: { setAuthCloudAdapter, setAuthOnSuccess, setIsAuthModalOpen } };
});

describe('MindMapController auth bridge: ended sessions', () => {
  let backend: CloudBackend;
  let detach: (() => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
    Reflect.set(WorkspaceService, 'instance', null);
    backend = createCloudBackend();
    vi.stubGlobal('fetch', backend.fetchMock);
  });

  afterEach(() => {
    detach?.();
    detach = null;
    vi.unstubAllGlobals();
  });

  const signInCloud = async (): Promise<CloudStorageAdapter> => {
    const adapter = new CloudStorageAdapter(BASE_URL);
    await adapter.login('a@b.c', 'password1');
    WorkspaceService.getInstance().addCloudWorkspace(adapter);
    return adapter;
  };

  it('re-opens the login for the workspace whose token was refused', async () => {
    const modal = renderModalState();
    detach = new MindMapController().attachAuthModalBridge(modal.result.current.handlers);
    const adapter = await signInCloud();

    backend.fetchMock.mockImplementationOnce(async () => unauthorized());
    await act(async () => { await expect(adapter.loadAllMaps()).rejects.toMatchObject({ status: 401 }); });

    expect(modal.result.current.open).toBe(true);
    expect(modal.result.current.adapter).toBe(adapter);
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeUndefined();

    // Signing in again through the modal brings the workspace back.
    await adapter.login('a@b.c', 'password1');
    act(() => { modal.result.current.onSuccess?.(adapter); });
    expect(WorkspaceService.getInstance().isCloudAuthenticated()).toBe(true);
    expect(adapter.getSessionEndReason()).toBeNull();
  });

  it('picks up a session that ended before the bridge was attached', async () => {
    const adapter = await signInCloud();
    backend.fetchMock.mockImplementationOnce(async () => unauthorized());
    await expect(adapter.loadAllMaps()).rejects.toMatchObject({ status: 401 });

    const modal = renderModalState();
    act(() => {
      detach = new MindMapController().attachAuthModalBridge(modal.result.current.handlers);
    });

    expect(modal.result.current.open).toBe(true);
    expect(modal.result.current.adapter).toBe(adapter);
  });

  it('restores the group workspace (not the personal one) after a group re-login', async () => {
    const groupBackend = createCloudBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', groupBackend.fetchMock);
    const group = new GroupCloudStorageAdapter(BASE_URL);
    await group.login('a@b.c', 'password1', 'code');
    WorkspaceService.getInstance().addGroupWorkspace(group);
    const modal = renderModalState();
    detach = new MindMapController().attachAuthModalBridge(modal.result.current.handlers);

    groupBackend.fetchMock.mockImplementationOnce(async () => unauthorized());
    await act(async () => { await expect(group.loadAllMaps()).rejects.toMatchObject({ status: 401 }); });
    expect(modal.result.current.adapter).toBe(group);

    await group.login('a@b.c', 'password1', 'code');
    act(() => { modal.result.current.onSuccess?.(group); });
    expect(WorkspaceService.getInstance().isGroupAuthenticated()).toBe(true);
    expect(WorkspaceService.getInstance().getWorkspace('cloud')).toBeUndefined();
  });
});
