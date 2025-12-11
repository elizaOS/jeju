/**
 * Server-side authentication utilities
 * Verifies GitHub OAuth tokens and enforces authorization
 */

import { NextRequest, NextResponse } from "next/server";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

interface AuthResult {
  user: GitHubUser;
  token: string;
}

interface AuthError {
  error: string;
  status: number;
}

// Cache verified tokens to reduce GitHub API calls (5 minute TTL)
const tokenCache = new Map<string, { user: GitHubUser; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Verify a GitHub OAuth token and return the authenticated user
 */
export async function verifyGitHubToken(token: string): Promise<GitHubUser | null> {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  // Verify with GitHub
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    tokenCache.delete(token);
    return null;
  }

  const user = await response.json() as GitHubUser;

  // Cache the result
  tokenCache.set(token, {
    user,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });

  return user;
}

/**
 * Extract token from request headers
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Authenticate a request and return the user or error response
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  const token = extractToken(request);

  if (!token) {
    return {
      error: "Authorization header required. Use 'Bearer <token>' format.",
      status: 401,
    };
  }

  const user = await verifyGitHubToken(token);

  if (!user) {
    return {
      error: "Invalid or expired token",
      status: 401,
    };
  }

  return { user, token };
}

/**
 * Check if auth result is an error
 */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return "error" in result;
}

/**
 * Verify the authenticated user matches the requested username
 */
export function verifyUserOwnership(
  authenticatedUser: GitHubUser,
  requestedUsername: string
): boolean {
  return authenticatedUser.login.toLowerCase() === requestedUsername.toLowerCase();
}

/**
 * Create an unauthorized response with CORS headers
 */
export function unauthorizedResponse(
  error: string,
  corsHeaders: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error },
    { status: 401, headers: corsHeaders }
  );
}

/**
 * Create a forbidden response with CORS headers
 */
export function forbiddenResponse(
  error: string,
  corsHeaders: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error },
    { status: 403, headers: corsHeaders }
  );
}
