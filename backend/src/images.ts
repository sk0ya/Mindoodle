/**
 * Image storage helpers shared by the personal (`/api/images/...`) and group
 * (`/api/group/images/...`) routes. The two differ only in the storage scope,
 * so everything that touches R2 lives here and takes the scope as input.
 */

/** btoa() takes a string, and String.fromCharCode spreads its arguments onto the stack. */
const BASE64_CHUNK_SIZE = 0x8000;

export function getImageKey(scope: string, imagePath: string): string {
  return `maps/${scope}/${imagePath}`;
}

/**
 * Base64 for the legacy JSON image response. Building the binary string one
 * byte at a time allocates an intermediate string per byte and burns Worker CPU
 * time on large images; converting fixed-size chunks avoids that without
 * risking a stack overflow from spreading the whole buffer at once.
 */
export function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

/**
 * The etag a client presents in If-None-Match, unquoted, as R2's conditional
 * expects it. Browsers send the single strong etag they were given; a weak
 * prefix is tolerated because the bytes are what the etag identifies here.
 */
function parseIfNoneMatch(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0].trim();
  if (!first || first === '*') return null;
  const unprefixed = first.startsWith('W/') ? first.slice(2) : first;
  const unquoted = unprefixed.replace(/^"(.*)"$/, '$1');
  return unquoted || null;
}

/** A conditional get whose precondition failed returns the object without a body. */
function hasBody(object: R2Object | R2ObjectBody): object is R2ObjectBody {
  return 'body' in object;
}

export interface ImageReadOptions {
  /** `?raw=1`: respond with the bytes themselves rather than base64 in JSON. */
  raw: boolean;
  corsHeaders: Record<string, string>;
}

function jsonImageResponse(data: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Reads one image. The raw form exists because base64-in-JSON inflates every
 * transfer by a third and cannot be revalidated: with an ETag the client (or
 * the browser cache) can ask "still the same?" and get a bodiless 304.
 *
 * The legacy JSON form stays for frontends deployed before the raw form.
 */
export async function readImage(
  bucket: R2Bucket,
  key: string,
  request: Request,
  { raw, corsHeaders }: ImageReadOptions
): Promise<Response> {
  if (!raw) {
    const object = await bucket.get(key);
    if (!object) {
      return jsonImageResponse({ success: false, error: 'Image not found' }, 404, corsHeaders);
    }
    const bytes = new Uint8Array(await object.arrayBuffer());
    return jsonImageResponse({
      success: true,
      data: encodeBase64(bytes),
      contentType: object.httpMetadata?.contentType || 'image/png'
    }, 200, corsHeaders);
  }

  const presentedEtag = parseIfNoneMatch(request.headers.get('If-None-Match'));
  // With a conditional, R2 itself decides and returns metadata without a body
  // when the etag still matches, so a 304 never transfers the image.
  const object = presentedEtag
    ? await bucket.get(key, { onlyIf: { etagDoesNotMatch: presentedEtag } })
    : await bucket.get(key);

  if (!object) {
    return jsonImageResponse({ success: false, error: 'Image not found' }, 404, corsHeaders);
  }

  const headers: Record<string, string> = {
    ...corsHeaders,
    'ETag': object.httpEtag,
    // Images are per-user, and a path can be overwritten in place, so caches
    // may keep a copy but must revalidate it before use.
    'Cache-Control': 'private, no-cache',
  };

  if (!hasBody(object)) {
    return new Response(null, { status: 304, headers });
  }

  headers['Content-Type'] = object.httpMetadata?.contentType || 'application/octet-stream';
  return new Response(object.body, { status: 200, headers });
}

/**
 * Every key under `prefix`, relative to the scope root. R2 returns at most
 * 1000 objects per call, so a single list() silently dropped the rest.
 */
export async function listImagePaths(bucket: R2Bucket, scope: string, directoryPath: string): Promise<string[]> {
  const scopeRoot = getImageKey(scope, '');
  const prefix = getImageKey(scope, directoryPath);
  const files: string[] = [];

  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor });
    for (const object of listed.objects) {
      files.push(object.key.startsWith(scopeRoot) ? object.key.substring(scopeRoot.length) : object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return files;
}
