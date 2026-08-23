export interface User {
  id: string;
  email: string;
  passwordHash: string;
  groupId?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserSession {
  userId: string;
  email: string;
  groupId?: string;
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
  groupCode?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    groupId?: string;
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
  conflict?: {
    currentUpdatedAt: string;
  };
}

/**
 * Reply to a metadata-only read. It deliberately carries no `content`: the
 * point of the endpoint is to answer "has this changed?" without transferring
 * the document, and an empty string here would be indistinguishable from an
 * empty map to a client that used it by mistake.
 */
export interface MapMetadataResponse {
  success: boolean;
  map?: {
    id: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

export interface Env {
  USERS: KVNamespace;
  MAPS_BUCKET: R2Bucket;
  ALLOWED_EMAIL: string;
  ALLOWED_GROUP?: string;
}
