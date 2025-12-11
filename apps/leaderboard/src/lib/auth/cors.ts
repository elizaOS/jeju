/**
 * CORS configuration for API routes
 * Restricts origins to trusted domains only
 */

const ALLOWED_ORIGINS = [
  "https://leaderboard.jeju.network",
  "https://www.leaderboard.jeju.network",
  "https://jeju.network",
  "https://www.jeju.network",
  // Development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

/**
 * Get CORS headers for a request
 * Only allows requests from trusted origins
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  
  // Use the origin if allowed, otherwise use primary domain
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Create CORS headers from a request
 */
export function corsHeadersFromRequest(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  return getCorsHeaders(origin);
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}
