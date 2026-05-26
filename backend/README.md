# Mindoodle Backend

Cloudflare Workers backend for Mindoodle mind mapping application.

## Features

- User authentication with email/password (restricted to authorized users)
- Secure session management using JWT-like tokens
- Map data storage using Cloudflare R2
- User data storage using Cloudflare Workers KV
- CORS support for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Cloudflare resources:
   - Create a KV namespace for user data: `wrangler kv:namespace create "USERS"`
   - Create an R2 bucket for map storage: `wrangler r2 bucket create mindoodle-maps`
   - Update `wrangler.toml` with your actual KV namespace IDs and bucket names

3. Set environment variables in `wrangler.toml`:
   - `ALLOWED_EMAIL`: The only email address allowed to register (currently: shigekazukoya@gmail.com)
   - `ALLOWED_GROUP`: Optional group registration code. Users can register when they know this code. Their personal cloud remains private, and they can also access the separate group cloud area.

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (restricted)
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Maps
- `GET /api/maps` - List user's maps
- `POST /api/maps` - Create new map
- `GET /api/maps/:id` - Get specific map
- `PUT /api/maps/:id` - Update existing map
- `DELETE /api/maps/:id` - Delete map (soft delete)

### Health
- `GET /api/health` - Health check

All map endpoints require authentication via `Authorization: Bearer <token>` header.

## Security Notes

- Passwords are hashed using SHA-256
- Sessions expire after 30 days
- Only the configured email address or users with the configured group code can register
- Personal map and image operations are scoped to the authenticated user
- Group map and image operations use separate `/api/group/*` endpoints and are scoped to the shared group area for users registered with `ALLOWED_GROUP`
- CORS is configured to allow frontend access
