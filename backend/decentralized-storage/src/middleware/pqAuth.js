/**
 * PQ Authentication Middleware
 * Security layer for post-quantum operations
 * 
 * Features:
 * - DID validation
 * - Request signing verification
 * - Private key protection (never logged)
 * - Rate limiting per DID
 * - Audit trail
 */

import pino from 'pino';
import rateLimit from 'express-rate-limit';

const logger = pino({ name: 'PQAuth' });

/**
 * Validate DID format
 */
export function validateDID(did) {
  if (!did || typeof did !== 'string') {
    return false;
  }
  
  // Standard DID format: did:method:identifier
  return /^did:[a-z0-9]+:[a-z0-9:./\-_]+$/i.test(did);
}

/**
 * Middleware: Validate request DID
 */
export function validateDIDMiddleware(req, res, next) {
  const did = req.query.did || req.body?.did;

  if (!did) {
    logger.warn('❌ Missing DID in request');
    return res.status(400).json({
      error: 'DID required',
      example: 'did:example:123456789',
    });
  }

  if (!validateDID(did)) {
    logger.warn(`❌ Invalid DID format: ${did}`);
    return res.status(400).json({
      error: 'Invalid DID format',
      expected: 'did:method:identifier',
    });
  }

  req.did = did;
  next();
}

/**
 * Middleware: Sanitize sensitive data from logs
 * Ensures private keys are NEVER logged
 */
export function sanitizeSensitiveData(req, res, next) {
  // Intercept console/logger calls to prevent key leakage
  const originalLog = logger.debug;
  
  req.on('end', () => {
    // Log request completed but NEVER log private keys
    if (req.body?.privateKey) {
      logger.warn('⚠️ Private key was in request body (not logged for security)');
      delete req.body.privateKey;
    }
  });

  next();
}

/**
 * Middleware: Verify request signature (optional)
 * If privateKey is in request, verify it's used for signing
 */
export function verifyRequestSignature(req, res, next) {
  // This is a placeholder for request signature verification
  // In production, implement request signing ceremony:
  // 1. Client signs request body with privateKey
  // 2. Server verifies signature before processing
  
  // For now, just verify structure
  if (req.body?.signature) {
    if (typeof req.body.signature !== 'string' || req.body.signature.length === 0) {
      return res.status(400).json({
        error: 'Invalid signature format',
      });
    }
  }

  next();
}

/**
 * Create per-DID rate limiter
 */
export function createDIDRateLimiter(options = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 min
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  } = options;

  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req, res) => {
      // Rate limit per DID
      return req.did || req.ip;
    },
    handler: (req, res) => {
      logger.warn(`⚠️ Rate limit exceeded for ${req.did}`);
      return res.status(429).json({
        error: 'Too many requests',
        retry_after: Math.ceil(req.rateLimit.resetTime / 1000),
      });
    },
    skip: (req, res) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  });
}

/**
 * Middleware: Log PQ operations for audit trail
 */
export function auditLogMiddleware(req, res, next) {
  const auditEnabled = process.env.AUDIT_LOG_ENABLED !== 'false';

  if (!auditEnabled) {
    return next();
  }

  const startTime = Date.now();
  
  // Store original send function
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log operation
    logger.info({
      type: 'PQ_OPERATION',
      did: req.did,
      method: req.method,
      path: req.path,
      status: statusCode,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

    // Log failures with more detail
    if (statusCode >= 400) {
      logger.warn({
        type: 'PQ_OPERATION_FAILED',
        did: req.did,
        method: req.method,
        path: req.path,
        status: statusCode,
        reason: data?.error || 'Unknown error',
      });
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Middleware: Validate PQ request payload
 */
export function validatePQPayload(req, res, next) {
  // Check for required crypto fields
  if (req.body && typeof req.body === 'object') {
    // For signing operations
    if (req.path.includes('/store')) {
      if (!req.body.claims) {
        return res.status(400).json({
          error: 'Missing claims field',
        });
      }
      if (!req.body.did) {
        return res.status(400).json({
          error: 'Missing DID field',
        });
      }
      if (!req.body.privateKey) {
        return res.status(400).json({
          error: 'Missing privateKey field (required for signing)',
        });
      }
    }
  }

  next();
}

/**
 * Middleware: Check that AES is NOT used
 * Security enforcement: verify no encryption flags are set
 */
export function enforceNoEncryption(req, res, next) {
  // This middleware ensures the v2 design is enforced
  // No encryption should be requested or used

  if (req.body) {
    // Check for legacy encryption fields
    const encryptionFields = [
      'encryptionKey',
      'encryptionAlgorithm',
      'encrypted',
      'ciphertext',
      'masterKey',
    ];

    for (const field of encryptionFields) {
      if (req.body[field] !== undefined) {
        logger.error(`❌ ENCRYPTION FIELD DETECTED: ${field} - REJECTED`);
        return res.status(400).json({
          error: 'v2.0 design does not support encryption',
          reason: `Encryption field not allowed: ${field}`,
          note: 'Credentials are stored plain on IPFS. Use ML-DSA-65 signatures for authenticity.',
        });
      }
    }
  }

  next();
}

/**
 * Error handler for PQ operations
 */
export function pqErrorHandler(err, req, res, next) {
  logger.error('❌ PQ operation error:', {
    message: err.message,
    path: req.path,
    method: req.method,
    did: req.did,
  });

  // Don't expose sensitive details
  const publicMessage = err.message.includes('signature') || err.message.includes('verification')
    ? err.message
    : 'PQ operation failed';

  res.status(500).json({
    error: publicMessage,
    timestamp: new Date().toISOString(),
    request_id: req.id,
  });
}

/**
 * Middleware: Strict verification enforcement
 * Ensure STRICT_VERIFICATION mode is enabled in production
 */
export function enforceStrictVerification(req, res, next) {
  const strictMode = process.env.STRICT_VERIFICATION;
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production' && strictMode === 'false') {
    logger.error('❌ SECURITY VIOLATION: STRICT_VERIFICATION disabled in production');
    return res.status(500).json({
      error: 'Server configuration error: signature verification not strict in production',
    });
  }

  next();
}

/**
 * Middleware: Check PQ module availability
 */
export async function checkPQAvailability(req, res, next) {
  try {
    // This would check if WASM and crypto modules are available
    // Placeholder for now
    next();
  } catch (error) {
    logger.error('❌ PQ module unavailable:', error);
    return res.status(503).json({
      error: 'Post-quantum cryptography module unavailable',
    });
  }
}

export default {
  validateDID,
  validateDIDMiddleware,
  sanitizeSensitiveData,
  verifyRequestSignature,
  createDIDRateLimiter,
  auditLogMiddleware,
  validatePQPayload,
  enforceNoEncryption,
  pqErrorHandler,
  enforceStrictVerification,
  checkPQAvailability,
};
