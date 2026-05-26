import type { Env, User, UserSession, AuthRequest, AuthResponse } from './types';

export class AuthService {
  constructor(private env: Env) {}

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(password);
    return hashedPassword === hash;
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    await this.env.USERS.put(`session:${token}`, JSON.stringify(session));

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

    const user: User = JSON.parse(userStr);
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

    if (nextGroupId && user.groupId !== nextGroupId) {
      user.groupId = nextGroupId;
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    await this.env.USERS.put(`user:${email}`, JSON.stringify(user));
    await this.env.USERS.put(`user_by_id:${user.id}`, JSON.stringify(user));

    const token = this.generateToken();
    const session: UserSession = {
      userId: user.id,
      email: user.email,
      ...(user.groupId ? { groupId: user.groupId } : {}),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    await this.env.USERS.put(`session:${token}`, JSON.stringify(session));

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

    const sessionStr = await this.env.USERS.get(`session:${token}`);
    if (!sessionStr) return null;

    const session: UserSession = JSON.parse(sessionStr);

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      await this.env.USERS.delete(`session:${token}`);
      return null;
    }

    return session;
  }

  async logout(token: string): Promise<void> {
    if (token) {
      await this.env.USERS.delete(`session:${token}`);
    }
  }
}
