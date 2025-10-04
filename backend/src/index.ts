import type { Env, AuthRequest, UserSession } from './types';
import { AuthService } from './auth';
import { MapStorageService } from './mapStorage';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5200',
  'https://mindoodle.com',
  'https://www.mindoodle.com',
  'https://sk0ya.github.io'
];

// Helper function to get CORS headers based on request origin
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Helper function to create JSON response with CORS
function jsonResponse(data: any, status = 200, request?: Request): Response {
  const corsHeaders = request ? getCorsHeaders(request) : { 'Access-Control-Allow-Origin': allowedOrigins[0] };

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper function to handle CORS preflight
function handleCors(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// Helper function to extract auth token
function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Helper function to authenticate request
async function authenticateRequest(request: Request, authService: AuthService): Promise<UserSession | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  return await authService.validateSession(token);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    const authService = new AuthService(env);
    const mapStorageService = new MapStorageService(env);

    try {
      // Authentication endpoints
      if (path === '/api/auth/register' && request.method === 'POST') {
        const { email, password }: AuthRequest = await request.json();

        if (!email || !password) {
          return jsonResponse({ success: false, error: 'Email and password are required' }, 400, request);
        }

        if (password.length < 8) {
          return jsonResponse({ success: false, error: 'Password must be at least 8 characters long' }, 400, request);
        }

        const result = await authService.register(email, password);
        return jsonResponse(result, result.success ? 200 : 400, request);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const { email, password }: AuthRequest = await request.json();

        if (!email || !password) {
          return jsonResponse({ success: false, error: 'Email and password are required' }, 400, request);
        }

        const result = await authService.login(email, password);
        return jsonResponse(result, result.success ? 200 : 401, request);
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        const token = getAuthToken(request);
        if (token) {
          await authService.logout(token);
        }
        return jsonResponse({ success: true }, 200, request);
      }

      if (path === '/api/auth/me' && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        return jsonResponse({
          success: true,
          user: {
            id: session.userId,
            email: session.email
          }
        }, 200, request);
      }

      // Map endpoints (require authentication)
      if (path === '/api/maps' && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const result = await mapStorageService.listMaps(session.userId);
        return jsonResponse(result, 200, request);
      }

      if (path === '/api/maps' && request.method === 'POST') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const body = await request.json() as { id?: string; title?: string; content?: string };
        const { id, title, content } = body;
        if (!title || !content) {
          return jsonResponse({ success: false, error: 'Title and content are required' }, 400, request);
        }

        // If client specifies an id (relative path like `Folder/name`), honor it; otherwise generate an id
        const initialId = id && id.trim() ? id.trim() : null;
        const result = await mapStorageService.saveMap(session.userId, initialId, title, content);
        return jsonResponse(result, 200, request);
      }

      if (path.startsWith('/api/maps/') && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        // Support nested map IDs with slashes by taking the full suffix after /api/maps/
        const mapId = decodeURIComponent(path.substring('/api/maps/'.length));
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400, request);
        }

        const result = await mapStorageService.getMap(session.userId, mapId);
        return jsonResponse(result, result.success ? 200 : 404, request);
      }

      if (path.startsWith('/api/maps/') && request.method === 'PUT') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const mapId = decodeURIComponent(path.substring('/api/maps/'.length));
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400, request);
        }

        const body = await request.json() as { title?: string; content?: string };
        const { title, content } = body;
        if (!title || !content) {
          return jsonResponse({ success: false, error: 'Title and content are required' }, 400, request);
        }

        const result = await mapStorageService.saveMap(session.userId, mapId, title, content);
        return jsonResponse(result, 200, request);
      }

      if (path.startsWith('/api/maps/') && request.method === 'DELETE') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const mapId = decodeURIComponent(path.substring('/api/maps/'.length));
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400, request);
        }

        const result = await mapStorageService.deleteMap(session.userId, mapId);
        return jsonResponse(result, result.success ? 200 : 404, request);
      }

      // Image endpoints (require authentication)
      if (path === '/api/images/upload' && request.method === 'POST') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const contentType = request.headers.get('Content-Type') || '';
        try {
          if (contentType.includes('multipart/form-data')) {
            // Multipart: expect 'path' and 'file'
            const form = await (request as any).formData();
            const imagePath = (form.get('path') as string) || '';
            const file = form.get('file') as File | null;
            if (!imagePath || !file) {
              return jsonResponse({ success: false, error: 'path and file are required' }, 400, request);
            }

            const r2Key = `maps/${session.userId}/${imagePath}`;
            const arrayBuffer = await file.arrayBuffer();
            await env.MAPS_BUCKET.put(r2Key, arrayBuffer, {
              httpMetadata: { contentType: (file as any).type || 'application/octet-stream' }
            });
            return jsonResponse({ success: true, path: imagePath }, 200, request);
          } else {
            // JSON base64 fallback
            const body = await request.json() as { path?: string; data?: string; contentType?: string };
            const { path: imagePath, data, contentType } = body;

            if (!imagePath || !data || !contentType) {
              return jsonResponse({ success: false, error: 'Path, data, and contentType are required' }, 400, request);
            }

            const binaryString = atob(data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

            const r2Key = `maps/${session.userId}/${imagePath}`;
            await env.MAPS_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType } });
            return jsonResponse({ success: true, path: imagePath }, 200, request);
          }
        } catch (error) {
          console.error('Image upload error:', error);
          return jsonResponse({ success: false, error: 'Failed to upload image' }, 500, request);
        }
      }

      if (path.startsWith('/api/images/') && !path.includes('/list') && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const imagePath = decodeURIComponent(path.substring('/api/images/'.length));
        if (!imagePath) {
          return jsonResponse({ success: false, error: 'Image path is required' }, 400, request);
        }

        try {
          const r2Key = `maps/${session.userId}/${imagePath}`;
          const object = await env.MAPS_BUCKET.get(r2Key);

          if (!object) {
            return jsonResponse({ success: false, error: 'Image not found' }, 404, request);
          }

          // Convert to base64 for JSON response
          const arrayBuffer = await object.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binaryString = '';
          for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binaryString);

          return jsonResponse({
            success: true,
            data: base64Data,
            contentType: object.httpMetadata?.contentType || 'image/png'
          }, 200, request);
        } catch (error) {
          console.error('Image download error:', error);
          return jsonResponse({ success: false, error: 'Failed to download image' }, 500, request);
        }
      }

      if (path.startsWith('/api/images/') && request.method === 'DELETE') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const imagePath = decodeURIComponent(path.substring('/api/images/'.length));
        if (!imagePath) {
          return jsonResponse({ success: false, error: 'Image path is required' }, 400, request);
        }

        try {
          const r2Key = `maps/${session.userId}/${imagePath}`;
          await env.MAPS_BUCKET.delete(r2Key);

          return jsonResponse({ success: true }, 200, request);
        } catch (error) {
          console.error('Image delete error:', error);
          return jsonResponse({ success: false, error: 'Failed to delete image' }, 500, request);
        }
      }

      if (path === '/api/images/list' && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
        }

        const directoryPath = url.searchParams.get('path') || '';

        try {
          const prefix = `maps/${session.userId}/${directoryPath}`;
          const listed = await env.MAPS_BUCKET.list({ prefix });

          const files = listed.objects.map(obj => {
            // Remove maps/{userId} prefix from the key
            const removePrefix = `maps/${session.userId}/`;
            return obj.key.startsWith(removePrefix) ? obj.key.substring(removePrefix.length) : obj.key;
          });

          return jsonResponse({ success: true, files }, 200, request);
        } catch (error) {
          console.error('Image list error:', error);
          return jsonResponse({ success: false, error: 'Failed to list images' }, 500, request);
        }
      }

      // Health check
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse({ success: true, message: 'Mindoodle Backend is running' }, 200, request);
      }

      // 404 for unknown routes
      return jsonResponse({ success: false, error: 'Not Found' }, 404, request);

    } catch (error) {
      console.error('Unhandled error:', error);
      return jsonResponse({ success: false, error: 'Internal Server Error' }, 500, request);
    }
  },
};
