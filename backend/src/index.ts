import type { Env, AuthRequest, UserSession } from './types';
import { AuthService } from './auth';
import { MapStorageService } from './mapStorage';

// CORS headers for frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper function to create JSON response with CORS
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper function to handle CORS preflight
function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
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
      return handleCors();
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
          return jsonResponse({ success: false, error: 'Email and password are required' }, 400);
        }

        if (password.length < 8) {
          return jsonResponse({ success: false, error: 'Password must be at least 8 characters long' }, 400);
        }

        const result = await authService.register(email, password);
        return jsonResponse(result, result.success ? 200 : 400);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const { email, password }: AuthRequest = await request.json();

        if (!email || !password) {
          return jsonResponse({ success: false, error: 'Email and password are required' }, 400);
        }

        const result = await authService.login(email, password);
        return jsonResponse(result, result.success ? 200 : 401);
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        const token = getAuthToken(request);
        if (token) {
          await authService.logout(token);
        }
        return jsonResponse({ success: true });
      }

      if (path === '/api/auth/me' && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        return jsonResponse({
          success: true,
          user: {
            id: session.userId,
            email: session.email
          }
        });
      }

      // Map endpoints (require authentication)
      if (path === '/api/maps' && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        const result = await mapStorageService.listMaps(session.userId);
        return jsonResponse(result);
      }

      if (path === '/api/maps' && request.method === 'POST') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        const { title, content } = await request.json();
        if (!title || !content) {
          return jsonResponse({ success: false, error: 'Title and content are required' }, 400);
        }

        const result = await mapStorageService.saveMap(session.userId, null, title, content);
        return jsonResponse(result);
      }

      if (path.startsWith('/api/maps/') && request.method === 'GET') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        const mapId = path.split('/')[3];
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400);
        }

        const result = await mapStorageService.getMap(session.userId, mapId);
        return jsonResponse(result, result.success ? 200 : 404);
      }

      if (path.startsWith('/api/maps/') && request.method === 'PUT') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        const mapId = path.split('/')[3];
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400);
        }

        const { title, content } = await request.json();
        if (!title || !content) {
          return jsonResponse({ success: false, error: 'Title and content are required' }, 400);
        }

        const result = await mapStorageService.saveMap(session.userId, mapId, title, content);
        return jsonResponse(result);
      }

      if (path.startsWith('/api/maps/') && request.method === 'DELETE') {
        const session = await authenticateRequest(request, authService);
        if (!session) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        const mapId = path.split('/')[3];
        if (!mapId) {
          return jsonResponse({ success: false, error: 'Map ID is required' }, 400);
        }

        const result = await mapStorageService.deleteMap(session.userId, mapId);
        return jsonResponse(result, result.success ? 200 : 404);
      }

      // Health check
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse({ success: true, message: 'Mindoodle Backend is running' });
      }

      // 404 for unknown routes
      return jsonResponse({ success: false, error: 'Not Found' }, 404);

    } catch (error) {
      console.error('Unhandled error:', error);
      return jsonResponse({ success: false, error: 'Internal Server Error' }, 500);
    }
  },
};