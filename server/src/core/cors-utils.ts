/**
 * Builds CORS response headers from an origin allowlist and an incoming request.
 *
 * When the allowlist contains `*`, falls back to wildcard behavior (dev mode).
 * Otherwise, echoes the request origin only if it appears in the allowlist;
 * requests from unlisted origins receive no allow-origin header so browsers
 * refuse the response. The `Vary: Origin` header prevents caches from serving
 * the wrong allow-origin to a different origin.
 *
 * @param allowed         Allowlist of permitted origins, or `['*']` for dev mode.
 * @param req             Optional incoming request; used to read the `Origin` header.
 * @param allowedMethods  Comma-separated HTTP methods for the allow-methods header.
 *                        Defaults to `'GET, POST, DELETE, OPTIONS'`.
 */
export function buildCorsHeaders(
  allowed: string[],
  req?: Request,
  allowedMethods = 'GET, POST, DELETE, OPTIONS',
): Record<string, string> {
  const requestOrigin = req?.headers.get('origin') ?? '';

  // When the allowlist is exactly ['*'], fall back to wildcard behavior.
  const originHeader = allowed.includes('*')
    ? '*'
    : allowed.includes(requestOrigin)
      ? requestOrigin
      : '';

  const headers: Record<string, string> = {
    'access-control-allow-methods': allowedMethods,
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };

  // Only include the allow-origin header when the origin is permitted.
  if (originHeader) {
    headers['access-control-allow-origin'] = originHeader;
  }

  return headers;
}
