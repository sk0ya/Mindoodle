export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserSession {
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface MapData {
  id: string;
  userId: string;
  title: string;
  content: string; // JSON stringified map data
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
}

export interface MapListResponse {
  success: boolean;
  maps?: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
}

export interface MapResponse {
  success: boolean;
  map?: MapData;
  error?: string;
}

export interface Env {
  USERS: KVNamespace;
  MAPS_BUCKET: R2Bucket;
  ALLOWED_EMAIL: string;
}