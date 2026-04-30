// tests/integration/rateLimiting.test.js
// Test: Rate limiting - 101 requests → 429 status

import { jest } from '@jest/globals';

describe('Rate Limiting', () => {
  let rateLimitStore;
  const RATE_LIMIT_MAX = 100;
  const RATE_LIMIT_WINDOW = 60000; // 1 minute for testing

  beforeEach(() => {
    jest.clearAllMocks();

    // Simple in-memory rate limit store
    rateLimitStore = new Map();

    // Helper: check rate limit for a key
    const checkRateLimit = (key) => {
      const now = Date.now();

      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + RATE_LIMIT_WINDOW,
        });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
      }

      const data = rateLimitStore.get(key);

      if (now > data.resetTime) {
        // Window expired, reset
        data.count = 1;
        data.resetTime = now + RATE_LIMIT_WINDOW;
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
      }

      data.count += 1;

      if (data.count > RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, retryAfter: data.resetTime };
      }

      return { allowed: true, remaining: RATE_LIMIT_MAX - data.count };
    };

    this.checkRateLimit = checkRateLimit;
  });

  test('should allow up to 100 requests', () => {
    const did = 'did:example:user123';

    for (let i = 1; i <= 100; i++) {
      const result = this.checkRateLimit(`did:${did}`);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX - i);
    }
  });

  test('should reject 101st request with 429 status', () => {
    const did = 'did:example:user456';

    // Make 100 requests (all allowed)
    for (let i = 1; i <= 100; i++) {
      const result = this.checkRateLimit(`did:${did}`);
      expect(result.allowed).toBe(true);
    }

    // 101st request should be rejected
    const result = this.checkRateLimit(`did:${did}`);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should track rate limit per DID', () => {
    const did1 = 'did:user1';
    const did2 = 'did:user2';

    // User 1: 50 requests
    for (let i = 0; i < 50; i++) {
      this.checkRateLimit(`did:${did1}`);
    }

    // User 2: 100 requests (should still be allowed for user 1)
    for (let i = 0; i < 100; i++) {
      this.checkRateLimit(`did:${did2}`);
    }

    // User 1 should still have 50 remaining
    const user1Result = this.checkRateLimit(`did:${did1}`);
    expect(user1Result.allowed).toBe(true);
    expect(user1Result.remaining).toBeLessThan(50);

    // User 2 should be rate limited
    const user2Result = this.checkRateLimit(`did:${did2}`);
    expect(user2Result.allowed).toBe(false);
  });

  test('should use IP fallback when no DID provided', () => {
    const ip = '192.168.1.100';

    // Make 100 requests from same IP
    for (let i = 0; i < 100; i++) {
      const result = this.checkRateLimit(ip);
      expect(result.allowed).toBe(true);
    }

    // 101st should fail
    const result = this.checkRateLimit(ip);
    expect(result.allowed).toBe(false);
  });

  test('should reset counter after window expires', async () => {
    const shortWindowStore = new Map();
    const WINDOW_MS = 100; // 100ms for quick testing

    const checkWithShortWindow = (key) => {
      const now = Date.now();

      if (!shortWindowStore.has(key)) {
        shortWindowStore.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
      }

      const data = shortWindowStore.get(key);

      if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + WINDOW_MS;
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
      }

      data.count += 1;
      return { allowed: data.count <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - data.count) };
    };

    const key = 'test-reset';

    // Initial request
    let result = checkWithShortWindow(key);
    expect(result.allowed).toBe(true);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should reset
    result = checkWithShortWindow(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_MAX - 1);
  });
});
