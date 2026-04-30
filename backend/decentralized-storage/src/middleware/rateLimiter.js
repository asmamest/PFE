// src/middleware/rateLimiter.js
// Rate limiting middleware for protecting API endpoints.
// Based on IP or DID from request body.

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min

/**
 * Create a rate limiter with custom key generator (DID-based or IP-based).
 * @returns {Function} Express middleware
 */
export function createStoreLimiter() {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,               // 15 minutes
    max: RATE_LIMIT_MAX,                           // 100 requests
    standardHeaders: true,                         // Include rate limit info in headers
    legacyHeaders: false,                          // Disable old headers

    // Custom key generator: use DID from body if available, else IP
    keyGenerator: (req) => {
      const did = req.body?.metadata?.did || req.body?.did;
      if (did) {
        logger.debug(`[rateLimiter] Rate limit key: ${did}`);
        return `did:${did}`;
      }
      return req.ip;
    },

    // Custom handler for when limit exceeded
    handler: (req, res) => {
      const key = req.body?.metadata?.did || req.body?.did || req.ip;
      logger.warn(`[rateLimiter] Rate limit exceeded for key: ${key}`);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: req.rateLimit.resetTime,
      });
    },

    // Skip certain requests (e.g., health checks)
    skip: (req) => {
      return req.path === '/health' || req.path === '/health/';
    },

    // Custom message
    message: 'Too many requests, please try again later.',
  });
}

/**
 * More restrictive rate limiter for critical endpoints.
 * @returns {Function} Express middleware
 */
export function createStrictLimiter() {
  return rateLimit({
    windowMs: 60000,          // 1 minute
    max: 10,                  // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const did = req.body?.metadata?.did || req.body?.did;
      return did ? `did:${did}` : req.ip;
    },
    handler: (req, res) => {
      logger.warn(`[strict-limiter] Rate limit exceeded for: ${req.ip}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests in a short time',
        retryAfter: 60,
      });
    },
  });
}

/**
 * Custom in-memory store for rate limit data (alternative to Redis).
 * Returns a store compatible with express-rate-limit.
 */
export function createMemoryStore() {
  const store = new Map(); // { key: { count, resetTime } }

  return {
    increment: (key) => {
      const now = Date.now();
      if (!store.has(key)) {
        store.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return { count: 1, totalHits: 1 };
      }

      const data = store.get(key);
      if (now > data.resetTime) {
        // Window expired
        data.count = 1;
        data.resetTime = now + RATE_LIMIT_WINDOW_MS;
      } else {
        data.count += 1;
      }

      return { count: data.count, totalHits: data.count };
    },

    decrement: (key) => {
      const data = store.get(key);
      if (data && data.count > 0) {
        data.count -= 1;
      }
    },

    resetKey: (key) => {
      store.delete(key);
    },

    // Cleanup expired entries periodically
    cleanup: () => {
      const now = Date.now();
      for (const [key, data] of store) {
        if (now > data.resetTime) {
          store.delete(key);
        }
      }
    },
  };
}

// Start cleanup job every 5 minutes
const memoryStore = createMemoryStore();
setInterval(() => memoryStore.cleanup(), 5 * 60 * 1000);

export default createStoreLimiter();
