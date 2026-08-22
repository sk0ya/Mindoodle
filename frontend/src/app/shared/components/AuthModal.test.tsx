import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';

const adapter = () => ({
  login: vi.fn(), register: vi.fn()
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
});
