import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';
import { GroupCloudStorageAdapter, GROUP_MEMBERSHIP_REQUIRED_MESSAGE, type CloudSessionEndReason } from '../../core/storage/adapters/CloudStorageAdapter';
import { STORAGE_KEYS } from '@shared/utils';
import { BASE_URL, createCloudBackend } from '../../../test/cloudBackendMock';

const adapter = () => ({
  login: vi.fn(), register: vi.fn(), getSessionEndReason: vi.fn((): CloudSessionEndReason | null => null)
});

describe('AuthModal', () => {
  it('does not render while closed', () => {
    render(<AuthModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} cloudAdapter={adapter() as never} />);
    expect(screen.queryByText('ログイン')).toBeNull();
  });

  it('logs in successfully and clears the form', async () => {
    const cloud = adapter();
    cloud.login.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AuthModal isOpen onClose={onClose} onSuccess={onSuccess} cloudAdapter={cloud as never} />);

    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('グループ認証コード'), { target: { value: 'group' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(cloud));
    expect(cloud.login).toHaveBeenCalledWith('user@example.com', 'password123', 'group');
    expect(onClose).toHaveBeenCalled();
    const emailInput = screen.getByLabelText('メールアドレス');
    if (emailInput instanceof HTMLInputElement) {
      expect(emailInput.value).toBe('');
    }
  });

  it('shows validation errors without calling the adapter', async () => {
    const cloud = adapter();
    const { rerender } = render(<AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} cloudAdapter={cloud as never} />);

    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'short' } });
    const loginForm = screen.getByRole('button', { name: 'ログイン' }).closest('form');
    expect(loginForm).toBeTruthy();
    if (loginForm) fireEvent.submit(loginForm);
    expect(await screen.findByText('Password must be at least 8 characters long')).not.toBeNull();
    expect(cloud.login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'アカウントを作成' }));
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('パスワード確認'), { target: { value: 'different12' } });
    const registerForm = screen.getByRole('button', { name: 'アカウントを作成' }).closest('form');
    expect(registerForm).toBeTruthy();
    if (registerForm) fireEvent.submit(registerForm);
    expect(await screen.findByText('Passwords do not match')).not.toBeNull();
    expect(cloud.register).not.toHaveBeenCalled();
    rerender(<AuthModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} cloudAdapter={cloud as never} />);
  });

  it('shows server errors and supports switching back to login', async () => {
    const cloud = adapter();
    cloud.register.mockResolvedValue({ success: false, error: 'Email already exists' });
    const onClose = vi.fn();
    render(<AuthModal isOpen onClose={onClose} onSuccess={vi.fn()} cloudAdapter={cloud as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'アカウントを作成' }));
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('パスワード確認'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'アカウントを作成' }));
    expect(await screen.findByText('Email already exists')).not.toBeNull();
    expect(cloud.register).toHaveBeenCalledWith('new@example.com', 'password123', '');

    fireEvent.click(screen.getByRole('button', { name: 'ログインに戻る' }));
    expect(screen.getByRole('heading', { name: 'ログイン' })).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says why when it was opened because the session ended', () => {
    const cloud = adapter();
    cloud.getSessionEndReason.mockReturnValue('expired');
    render(<AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} cloudAdapter={cloud as never} />);

    expect(screen.getByRole('status').textContent).toBe('セッションの有効期限が切れました。再度ログインしてください。');
  });

  it('shows no session notice for an ordinary login', () => {
    render(<AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} cloudAdapter={adapter() as never} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('AuthModal with the group adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the modal open with an error when the account has no group, and stores no token', async () => {
    localStorage.clear();
    const backend = createCloudBackend({ mapsPath: '/api/group/maps', imagesPath: '/api/group/images' });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => (
      String(input).endsWith('/api/auth/login')
        ? ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, token: 't', user: { id: 'u1', email: 'a@b.c' } }) } as unknown as Response)
        : backend.fetchMock(input, init)
    )));
    const group = new GroupCloudStorageAdapter(BASE_URL);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AuthModal isOpen onClose={onClose} onSuccess={onSuccess} cloudAdapter={group} />);

    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    expect(await screen.findByText(GROUP_MEMBERSHIP_REQUIRED_MESSAGE)).not.toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.GROUP_AUTH_TOKEN)).toBeNull();
    expect(group.isAuthenticated).toBe(false);
  });
});
