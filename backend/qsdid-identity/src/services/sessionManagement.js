/**
 * Session Management Service
 * 
 * Manages authentication session lifecycle:
 * - Challenge/nonce generation and validation
 * - Session state tracking
 * - Replay attack prevention
 * - Session timeout and expiration
 * - Nonce uniqueness enforcement
 */

import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class SessionManagementService {
  constructor(options = {}) {
    this.sessionStore = new Map();
    this.nonceStore = new Map();
    this.sessionTimeout = options.sessionTimeout || 5 * 60 * 1000; // 5 minutes
    this.nonceTTL = options.nonceTTL || 10 * 60 * 1000; // 10 minutes
    this.maxAttempts = options.maxAttempts || 5;
    this.lockoutDuration = options.lockoutDuration || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Initialize a new authentication session
   * @param {string} flowType - 'registration' or 'login'
   * @param {object} metadata - Additional session metadata
   * @returns {object} Session with challenge
   */
  initializeSession(flowType, metadata = {}) {
    const sessionId = uuidv4();
    const timestamp = Date.now();

    // Generate cryptographically secure nonce
    const challenge = this._generateChallenge();

    const session = {
      sessionId,
      flowType, // 'registration' or 'login'
      challenge,
      timestamp,
      expiresAt: timestamp + this.sessionTimeout,
      
      // Attempt tracking
      attempts: 0,
      failedAttempts: 0,
      isLocked: false,
      lockedUntil: null,

      // State tracking
      currentState: 'INIT',
      previousStates: [],
      
      // Metadata
      metadata,
      
      // Security context
      nonces: [challenge], // Track all nonces used in this session
      usedNonces: new Set(), // Track consumed nonces
      
      // Binding tracking
      phoneApprovalId: null,
      publicKeyRegistered: null,
      walletAddress: null,
      deviceIdentifier: metadata.deviceIdentifier || null,
    };

    this.sessionStore.set(sessionId, session);
    this.nonceStore.set(challenge, {
      sessionId,
      createdAt: timestamp,
      expiresAt: timestamp + this.nonceTTL,
      used: false,
    });

    return {
      sessionId,
      challenge,
      expiresAt: session.expiresAt,
      flowType,
    };
  }

  /**
   * Retrieve session by ID
   */
  getSession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }

    // Check session expiration
    if (Date.now() > session.expiresAt) {
      this.sessionStore.delete(sessionId);
      throw new SessionExpiredError(`Session ${sessionId} has expired`);
    }

    // Check lockout
    if (session.isLocked && Date.now() < session.lockedUntil) {
      throw new SessionLockedError(
        `Session is locked. Try again after ${new Date(session.lockedUntil).toISOString()}`
      );
    }

    return session;
  }

  /**
   * Validate challenge/nonce
   * Ensures:
   * - Nonce exists and is valid
   * - Nonce not already consumed (replay protection)
   * - Nonce not expired
   * - Single-use enforcement
   */
  validateAndConsumNonce(sessionId, nonce) {
    const session = this.getSession(sessionId);
    const nonceData = this.nonceStore.get(nonce);

    if (!nonceData) {
      this._recordFailedAttempt(sessionId);
      throw new InvalidNonceError(`Nonce is invalid or unknown`);
    }

    if (nonceData.sessionId !== sessionId) {
      this._recordFailedAttempt(sessionId);
      throw new NonceMismatchError(`Nonce does not belong to this session`);
    }

    if (Date.now() > nonceData.expiresAt) {
      this.nonceStore.delete(nonce);
      this._recordFailedAttempt(sessionId);
      throw new NonceExpiredError(`Nonce has expired`);
    }

    if (nonceData.used) {
      session.usedNonces.add(nonce);
      throw new NonceAlreadyUsedError(`Nonce has already been consumed (REPLAY ATTACK)`);
    }

    // Mark nonce as consumed
    nonceData.used = true;
    nonceData.consumedAt = Date.now();
    session.usedNonces.add(nonce);

    return {
      valid: true,
      sessionId,
      nonce,
      consumedAt: nonceData.consumedAt,
    };
  }

  /**
   * Record successful progress in session
   */
  updateSessionState(sessionId, newState, details = {}) {
    const session = this.getSession(sessionId);
    
    session.previousStates.push(session.currentState);
    session.currentState = newState;
    session.lastUpdate = Date.now();
    
    // Reset attempt counter on successful state transition
    session.attempts = 0;
    session.failedAttempts = 0;
    
    // Merge details into session
    Object.assign(session, details);
    
    return session;
  }

  /**
   * Bind phone approval to session (LPP verification)
   */
  bindPhoneApproval(sessionId, approvalId) {
    const session = this.getSession(sessionId);
    session.phoneApprovalId = approvalId;
    session.phoneApprovedAt = Date.now();
    return session;
  }

  /**
   * Bind device key to session
   */
  bindPublicKey(sessionId, publicKey) {
    const session = this.getSession(sessionId);
    session.publicKeyRegistered = publicKey;
    session.keyBoundAt = Date.now();
    return session;
  }

  /**
   * Bind wallet to session
   */
  bindWallet(sessionId, walletAddress) {
    const session = this.getSession(sessionId);
    session.walletAddress = walletAddress;
    session.walletBoundAt = Date.now();
    return session;
  }

  /**
   * Finalize session (issue token)
   */
  finalizeSession(sessionId) {
    const session = this.getSession(sessionId);
    session.finalizedAt = Date.now();
    session.isFinalized = true;
    return session;
  }

  /**
   * Revoke session (forced termination)
   */
  revokeSession(sessionId, reason = 'Administrative revocation') {
    const session = this.getSession(sessionId);
    session.isRevoked = true;
    session.revokedAt = Date.now();
    session.revocationReason = reason;
    return session;
  }

  /**
   * Record failed attempt and apply lockout if threshold exceeded
   * @private
   */
  _recordFailedAttempt(sessionId) {
    const session = this.getSession(sessionId);
    session.failedAttempts += 1;
    session.attempts += 1;

    if (session.failedAttempts >= this.maxAttempts) {
      session.isLocked = true;
      session.lockedUntil = Date.now() + this.lockoutDuration;
    }
  }

  /**
   * Generate cryptographically secure nonce
   * @private
   */
  _generateChallenge() {
    // 32 bytes = 256 bits of entropy
    return randomBytes(32).toString('hex');
  }

  /**
   * Cleanup expired sessions (background job)
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (now > session.expiresAt) {
        this.sessionStore.delete(sessionId);
        expiredSessions.push(sessionId);
      }
    }

    // Cleanup expired nonces
    for (const [nonce, data] of this.nonceStore.entries()) {
      if (now > data.expiresAt) {
        this.nonceStore.delete(nonce);
      }
    }

    return {
      cleanedSessions: expiredSessions.length,
      cleanedNonces: this.nonceStore.size,
    };
  }

  /**
   * Get session metrics (for monitoring)
   */
  getMetrics() {
    return {
      activeSessions: this.sessionStore.size,
      activeNonces: this.nonceStore.size,
      registrationSessions: Array.from(this.sessionStore.values()).filter(s => s.flowType === 'registration').length,
      loginSessions: Array.from(this.sessionStore.values()).filter(s => s.flowType === 'login').length,
      lockedSessions: Array.from(this.sessionStore.values()).filter(s => s.isLocked).length,
    };
  }
}

/**
 * Custom session errors
 */
class SessionNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionNotFoundError';
    this.code = 'SESSION_NOT_FOUND';
  }
}

class SessionExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionExpiredError';
    this.code = 'SESSION_EXPIRED';
  }
}

class SessionLockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionLockedError';
    this.code = 'SESSION_LOCKED';
  }
}

class InvalidNonceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidNonceError';
    this.code = 'INVALID_NONCE';
  }
}

class NonceMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NonceMismatchError';
    this.code = 'NONCE_MISMATCH';
  }
}

class NonceExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NonceExpiredError';
    this.code = 'NONCE_EXPIRED';
  }
}

class NonceAlreadyUsedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NonceAlreadyUsedError';
    this.code = 'NONCE_ALREADY_USED';
  }
}

export {
  SessionNotFoundError,
  SessionExpiredError,
  SessionLockedError,
  InvalidNonceError,
  NonceMismatchError,
  NonceExpiredError,
  NonceAlreadyUsedError,
};
