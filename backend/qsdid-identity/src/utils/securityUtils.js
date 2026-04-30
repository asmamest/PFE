/**
 * Security Utilities
 * 
 * Common security functions:
 * - Nonce management
 * - Challenge generation
 * - Rate limiting
 * - Input validation
 * - Error handling
 */

import crypto from 'crypto';

export class SecurityUtils {
  /**
   * Validate challenge/nonce format
   */
  static validateChallenge(challenge) {
    if (typeof challenge !== 'string') {
      throw new TypeError('Challenge must be a string');
    }

    if (challenge.length < 32) {
      throw new Error('Challenge is too short (minimum 32 bytes hex)');
    }

    if (!/^[0-9a-f]{64,}$/i.test(challenge)) {
      throw new Error('Challenge must be valid hexadecimal');
    }

    return true;
  }

  /**
   * Validate signature format
   */
  static validateSignature(signature) {
    if (typeof signature !== 'string') {
      throw new TypeError('Signature must be a string');
    }

    if (!/^[0-9a-f]{0,}$/i.test(signature)) {
      throw new Error('Signature must be valid hexadecimal');
    }

    // Check reasonable length (ECDSA P-256 is ~128 hex chars)
    if (signature.length < 64 || signature.length > 512) {
      throw new Error('Signature length is invalid');
    }

    return true;
  }

  /**
   * Validate Ethereum wallet address format
   */
  static validateWalletAddress(address) {
    if (typeof address !== 'string') {
      throw new TypeError('Wallet address must be a string');
    }

    if (!/^0x[0-9a-f]{40}$/i.test(address)) {
      throw new Error('Invalid Ethereum wallet address format');
    }

    return true;
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid) {
    if (typeof uuid !== 'string') {
      throw new TypeError('UUID must be a string');
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      throw new Error('Invalid UUID format');
    }

    return true;
  }

  /**
   * Validate device identifier
   */
  static validateDeviceIdentifier(identifier) {
    if (typeof identifier !== 'string') {
      throw new TypeError('Device identifier must be a string');
    }

    if (identifier.length < 8 || identifier.length > 255) {
      throw new Error('Device identifier length invalid');
    }

    if (!/^[a-z0-9\-_]+$/i.test(identifier)) {
      throw new Error('Device identifier contains invalid characters');
    }

    return true;
  }

  /**
   * Rate limiter (in-memory)
   * Returns { allowed: boolean, remaining: number, resetAfter: number }
   */
  static createRateLimiter(maxAttempts = 5, windowMs = 60000) {
    const attempts = new Map();

    return {
      checkLimit: (key) => {
        const now = Date.now();
        const record = attempts.get(key);

        if (!record || now > record.resetAt) {
          // New window
          attempts.set(key, {
            count: 1,
            resetAt: now + windowMs,
          });

          return {
            allowed: true,
            remaining: maxAttempts - 1,
            resetAfter: windowMs,
          };
        }

        if (record.count >= maxAttempts) {
          return {
            allowed: false,
            remaining: 0,
            resetAfter: record.resetAt - now,
          };
        }

        record.count++;
        return {
          allowed: true,
          remaining: maxAttempts - record.count,
          resetAfter: record.resetAt - now,
        };
      },

      reset: (key) => {
        attempts.delete(key);
      },

      getAttempts: (key) => {
        const record = attempts.get(key);
        if (!record) return 0;
        if (Date.now() > record.resetAt) return 0;
        return record.count;
      },
    };
  }

  /**
   * Safe JSON stringify with error handling
   */
  static safeStringify(obj, maxDepth = 5) {
    const seen = new WeakSet();

    function replacer(key, value, depth = 0) {
      if (depth > maxDepth) return '[Max Depth Exceeded]';

      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }

      if (typeof value === 'function') {
        return '[Function]';
      }

      return value;
    }

    try {
      return JSON.stringify(obj, replacer);
    } catch (error) {
      return `[Error stringifying: ${error.message}]`;
    }
  }

  /**
   * Mask sensitive data in logs
   */
  static maskSensitiveData(data) {
    const masked = { ...data };

    const sensitiveFields = [
      'password',
      'privateKey',
      'signature',
      'challenge',
      'token',
      'secret',
      'apiKey',
    ];

    for (const field of sensitiveFields) {
      if (field in masked) {
        const value = masked[field];
        if (typeof value === 'string') {
          masked[field] = `***${value.slice(-4)}`;
        }
      }
    }

    return masked;
  }

  /**
   * Generate cryptographically secure random string
   */
  static generateRandomString(length = 32, encoding = 'hex') {
    const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
    return bytes.toString(encoding).slice(0, length);
  }

  /**
   * Time-constant string comparison (prevents timing attacks)
   */
  static timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Sanitize object for logging (remove sensitive fields)
   */
  static sanitizeForLogging(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sensitiveFields = new Set([
      'password',
      'privateKey',
      'signature',
      'challenge',
      'token',
      'secret',
      'apiKey',
      'sessionKey',
      'refreshToken',
    ]);

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = `${value.substring(0, 50)}...[truncated]`;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate timestamp (within reasonable bounds)
   */
  static validateTimestamp(timestamp, maxAgeMs = 3600000) {
    if (typeof timestamp !== 'number') {
      throw new TypeError('Timestamp must be a number');
    }

    const now = Date.now();
    const age = now - timestamp;

    if (age < 0) {
      throw new Error('Timestamp is in the future');
    }

    if (age > maxAgeMs) {
      throw new Error(`Timestamp is too old (${Math.round(age / 1000)}s > ${Math.round(maxAgeMs / 1000)}s)`);
    }

    return true;
  }

  /**
   * Escape HTML to prevent XSS
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') {
      return text;
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, char => map[char]);
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = 'VALIDATION_ERROR';
  }
}
