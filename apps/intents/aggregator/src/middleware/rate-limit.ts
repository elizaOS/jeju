/**
 * @fileoverview Rate limiting middleware for aggregator
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();

interface RateLimitOptions {
  windowMs?: number;       // Time window in ms
  maxRequests?: number;    // Max requests per window
  keyGenerator?: (req: Request) => string;
  skipPaths?: string[];
  message?: string;
}

const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: process.env.NODE_ENV === 'test' ? 10000 : 1000, // Higher limits for testing
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
  skipPaths: ['/health', '/.well-known/agent-card.json'],
  message: 'Too many requests, please try again later',
};

export function rateLimit(options: RateLimitOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store) {
      if (now > value.resetAt) {
        store.delete(key);
      }
    }
  }, config.windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting for certain paths
    if (config.skipPaths.some(path => req.path.startsWith(path))) {
      next();
      return;
    }

    const key = config.keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      store.set(key, record);
    }

    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > config.maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// Stricter rate limit for write operations
export function strictRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    maxRequests: process.env.NODE_ENV === 'test' ? 10000 : 200,
    message: 'Rate limit exceeded for write operations',
  });
}

// Rate limit for A2A/MCP endpoints
export function agentRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    maxRequests: process.env.NODE_ENV === 'test' ? 10000 : 500,
    keyGenerator: (req) => {
      // Use agent identifier if provided
      const agentId = req.headers['x-agent-id'] as string;
      return agentId || req.ip || 'unknown';
    },
  });
}

