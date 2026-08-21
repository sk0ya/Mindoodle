import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL =
  process.env.MINDOODLE_API_URL ||
  'https://mindoodle-backend-production.shigekazukoya.workers.dev';

let authToken: string | null = null;

async function apiRequest(path: string, method: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const server = new Server(
  { name: 'mindoodle-cloud', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'login',
      description: 'Mindoodleクラウドバックエンドに認証します',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'メールアドレス' },
          password: { type: 'string', description: 'パスワード' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'list_maps',
      description: 'クラウドに保存されているマインドマップの一覧を取得します',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_map',
      description: '指定IDのマインドマップを取得します',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'マップID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_map',
      description: '新しいマインドマップを作成します',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'マップタイトル' },
          content: { type: 'string', description: 'マップデータ（JSON文字列）' },
          id: { type: 'string', description: '任意のマップID（フォルダパス形式 例: Folder/name）' },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'update_map',
      description: '既存のマインドマップを更新します',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'マップID' },
          title: { type: 'string', description: 'マップタイトル' },
          content: { type: 'string', description: 'マップデータ（JSON文字列）' },
        },
        required: ['id', 'title', 'content'],
      },
    },
    {
      name: 'delete_map',
      description: 'マインドマップを削除します',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'マップID' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, string>;

  try {
    switch (name) {
      case 'login': {
        const result = (await apiRequest('/api/auth/login', 'POST', {
          email: a['email'],
          password: a['password'],
        })) as { success: boolean; token?: string; user?: { email: string }; error?: string };

        if (result.success && result.token) {
          authToken = result.token;
          return {
            content: [{ type: 'text', text: `ログイン成功: ${result.user?.email}` }],
          };
        }
        return {
          content: [{ type: 'text', text: `ログイン失敗: ${result.error}` }],
          isError: true,
        };
      }

      case 'list_maps': {
        if (!authToken) {
          return {
            content: [{ type: 'text', text: 'まずloginツールで認証してください' }],
            isError: true,
          };
        }
        const result = await apiRequest('/api/maps', 'GET');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_map': {
        if (!authToken) {
          return {
            content: [{ type: 'text', text: 'まずloginツールで認証してください' }],
            isError: true,
          };
        }
        const result = await apiRequest(
          `/api/maps/${encodeURIComponent(a['id'])}`,
          'GET'
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'create_map': {
        if (!authToken) {
          return {
            content: [{ type: 'text', text: 'まずloginツールで認証してください' }],
            isError: true,
          };
        }
        const body: Record<string, string> = { title: a['title'], content: a['content'] };
        if (a['id']) body['id'] = a['id'];
        const result = await apiRequest('/api/maps', 'POST', body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'update_map': {
        if (!authToken) {
          return {
            content: [{ type: 'text', text: 'まずloginツールで認証してください' }],
            isError: true,
          };
        }
        const result = await apiRequest(
          `/api/maps/${encodeURIComponent(a['id'])}`,
          'PUT',
          { title: a['title'], content: a['content'] }
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'delete_map': {
        if (!authToken) {
          return {
            content: [{ type: 'text', text: 'まずloginツールで認証してください' }],
            isError: true,
          };
        }
        const result = await apiRequest(
          `/api/maps/${encodeURIComponent(a['id'])}`,
          'DELETE'
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `不明なツール: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `エラー: ${String(error)}` }],
      isError: true,
    };
  }
});

// Auto-login from env vars if available
const envEmail = process.env.MINDOODLE_EMAIL;
const envPassword = process.env.MINDOODLE_PASSWORD;
if (envEmail && envPassword) {
  try {
    const result = await apiRequest('/api/auth/login', 'POST', {
      email: envEmail,
      password: envPassword,
    });
    const r = result as { success: boolean; token?: string };
    if (r.success && r.token) {
      authToken = r.token;
    }
  } catch {
    // Start the server even when optional automatic authentication fails.
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
