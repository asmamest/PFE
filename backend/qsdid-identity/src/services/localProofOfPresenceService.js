/**
 * Local Proof of Presence Service with Authenticator App Integration
 * 
 * Integrates with multi-factor authentication authenticator apps:
 * - Google Authenticator / Microsoft Authenticator / Authy
 * - Push notifications
 * - TOTP (Time-based One-Time Password)
 * - HOTP (HMAC-based One-Time Password)
 * - Out-of-band approval
 */

import crypto from 'crypto';

export class LocalProofOfPresenceService {
  constructor(options = {}) {
    this.lppChallenges = new Map(); // challengeId -> challenge record
    this.authenticatorDevices = new Map(); // userId -> [devices]
    this.approvalTimeout = options.approvalTimeout || 5 * 60 * 1000; // 5 minutes
    this.totpTimeStep = options.totpTimeStep || 30; // 30 seconds
    this.totpDigits = options.totpDigits || 6;
    this.maxRetries = options.maxRetries || 3;
    this.authenticatorTypes = new Set(['TOTP', 'HOTP', 'PUSH_NOTIFICATION']);
  }

  /**
   * Register authenticator device
   * In production: bind to real authenticator app via QR code
   */
  registerAuthenticator(userId, deviceInfo) {
    const authenticatorId = 'auth_' + crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    const authenticator = {
      id: authenticatorId,
      userId,
      type: deviceInfo.type || 'TOTP', // TOTP, HOTP, or PUSH_NOTIFICATION
      name: deviceInfo.name || 'My Authenticator',
      
      // Shared secret for TOTP/HOTP
      sharedSecret: deviceInfo.sharedSecret || crypto.randomBytes(32).toString('hex'),
      
      // Push notification details
      pushToken: deviceInfo.pushToken || null,
      pushProvider: deviceInfo.pushProvider || null, // firebase, microsoft, apple
      
      // Device binding
      deviceIdentifier: deviceInfo.deviceIdentifier || null,
      osType: deviceInfo.osType || null,
      appVersion: deviceInfo.appVersion || null,
      
      // Metadata
      registeredAt: timestamp,
      lastUsedAt: null,
      isActive: true,
      isPrimary: deviceInfo.isPrimary || false,
      
      // Security tracking
      verificationCount: 0,
      failureCount: 0,
      lastVerificationStatus: null,
    };

    // Store authenticator
    if (!this.authenticatorDevices.has(userId)) {
      this.authenticatorDevices.set(userId, []);
    }

    this.authenticatorDevices.get(userId).push(authenticator);

    return {
      authenticatorId,
      type: authenticator.type,
      name: authenticator.name,
      registeredAt: timestamp,
      requiresQRCode: authenticator.type !== 'PUSH_NOTIFICATION',
    };
  }

  /**
   * Initiate LPP challenge via authenticator app
   */
  initiateLPPChallenge(userId, sessionId, metadata = {}) {
    const authenticators = this.authenticatorDevices.get(userId) || [];

    if (authenticators.length === 0) {
      throw new NoAuthenticatorsError(`No authenticators registered for user ${userId}`);
    }

    const primaryAuth = authenticators.find(a => a.isPrimary) || authenticators[0];

    const challengeId = 'lpp_' + crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + this.approvalTimeout;

    const challenge = {
      id: challengeId,
      sessionId,
      userId,
      authenticatorId: primaryAuth.id,
      
      // Challenge data
      challenge: crypto.randomBytes(32).toString('hex'),
      type: primaryAuth.type,
      
      // Timestamps
      createdAt: timestamp,
      expiresAt,
      
      // Status tracking
      status: 'PENDING', // PENDING, APPROVED, REJECTED, EXPIRED
      approvedAt: null,
      rejectedAt: null,
      
      // Verification attempts
      attempts: 0,
      failedAttempts: 0,
      
      // Push notification (if applicable)
      pushNotificationSent: false,
      pushNotificationId: null,
      
      // Additional context
      metadata: {
        location: metadata.location || 'unknown',
        deviceModel: metadata.deviceModel || 'unknown',
        osType: metadata.osType || 'unknown',
        sessionContext: metadata.sessionContext || {},
      },
    };

    // Store challenge
    this.lppChallenges.set(challengeId, challenge);

    // Send push notification if type is PUSH_NOTIFICATION
    if (primaryAuth.type === 'PUSH_NOTIFICATION') {
      this._sendPushNotification(primaryAuth, challenge);
      challenge.pushNotificationSent = true;
    }

    return {
      challengeId,
      challenge: challenge.challenge,
      type: challenge.type,
      authenticatorName: primaryAuth.name,
      expiresAt,
      message: this._getAuthenticatorMessage(primaryAuth.type),
      totpRequired: primaryAuth.type === 'TOTP',
    };
  }

  /**
   * Approve LPP challenge via authenticator
   * For TOTP: verify the OTP code
   * For PUSH_NOTIFICATION: user approved in app
   * For HOTP: verify counter-based OTP
   */
  approveLPPChallenge(challengeId, approvalData = {}) {
    const challenge = this._getChallengeRecord(challengeId);

    if (challenge.status !== 'PENDING') {
      throw new InvalidChallengeStateError(
        `Challenge ${challengeId} is already ${challenge.status}`
      );
    }

    const now = Date.now();
    if (now > challenge.expiresAt) {
      challenge.status = 'EXPIRED';
      throw new LPPChallengeExpiredError(`LPP challenge has expired`);
    }

    const authenticator = this._getAuthenticatorRecord(
      challenge.userId,
      challenge.authenticatorId
    );

    try {
      // Verify based on authenticator type
      if (challenge.type === 'TOTP') {
        // Verify TOTP code
        const isValid = this._verifyTOTP(
          authenticator.sharedSecret,
          approvalData.totpCode,
          this.totpTimeStep,
          this.totpDigits
        );

        if (!isValid) {
          challenge.failedAttempts += 1;
          if (challenge.failedAttempts >= this.maxRetries) {
            challenge.status = 'REJECTED';
          }
          throw new InvalidTOTPError('TOTP code is invalid or expired');
        }
      } else if (challenge.type === 'HOTP') {
        // Verify HOTP
        const isValid = this._verifyHOTP(
          authenticator.sharedSecret,
          approvalData.hotpCode,
          approvalData.counter,
          this.totpDigits
        );

        if (!isValid) {
          challenge.failedAttempts += 1;
          throw new InvalidHOTPError('HOTP code is invalid');
        }
      } else if (challenge.type === 'PUSH_NOTIFICATION') {
        // For push notifications, just check that user approved
        if (!approvalData.approved) {
          challenge.status = 'REJECTED';
          throw new PushNotificationRejectedError('User rejected the push notification');
        }
      }

      // Mark as approved
      challenge.status = 'APPROVED';
      challenge.approvedAt = now;
      challenge.attempts = (challenge.attempts || 0) + 1;

      // Update authenticator
      authenticator.lastUsedAt = now;
      authenticator.verificationCount += 1;
      authenticator.lastVerificationStatus = 'SUCCESS';

      return {
        challengeId,
        status: 'APPROVED',
        approvedAt: challenge.approvedAt,
        authenticatorId: challenge.authenticatorId,
        lppToken: this._generateLPPToken(challenge),
        confidence: this._calculateApprovalConfidence(challenge, authenticator),
      };
    } catch (error) {
      authenticator.failureCount += 1;
      authenticator.lastVerificationStatus = 'FAILED';
      throw error;
    }
  }

  /**
   * Reject LPP challenge
   */
  rejectLPPChallenge(challengeId, reason = 'User rejected') {
    const challenge = this._getChallengeRecord(challengeId);

    if (challenge.status !== 'PENDING') {
      throw new InvalidChallengeStateError(`Challenge is already ${challenge.status}`);
    }

    challenge.status = 'REJECTED';
    challenge.rejectedAt = Date.now();

    const authenticator = this._getAuthenticatorRecord(
      challenge.userId,
      challenge.authenticatorId
    );
    authenticator.failureCount += 1;

    return {
      challengeId,
      status: 'REJECTED',
      rejectedAt: challenge.rejectedAt,
      reason,
    };
  }

  /**
   * Check LPP challenge status
   */
  getLPPChallengeStatus(challengeId) {
    const challenge = this._getChallengeRecord(challengeId);

    // Auto-expire if timeout reached
    if (challenge.status === 'PENDING' && Date.now() > challenge.expiresAt) {
      challenge.status = 'EXPIRED';
    }

    return {
      challengeId,
      status: challenge.status,
      createdAt: challenge.createdAt,
      expiresAt: challenge.expiresAt,
      approvedAt: challenge.approvedAt,
      type: challenge.type,
      authenticatorName: this._getAuthenticatorRecord(
        challenge.userId,
        challenge.authenticatorId
      ).name,
    };
  }

  /**
   * List registered authenticators for user
   */
  listAuthenticators(userId) {
    const authenticators = this.authenticatorDevices.get(userId) || [];

    return authenticators.map(auth => ({
      id: auth.id,
      name: auth.name,
      type: auth.type,
      isPrimary: auth.isPrimary,
      registeredAt: auth.registeredAt,
      lastUsedAt: auth.lastUsedAt,
      isActive: auth.isActive,
      verificationCount: auth.verificationCount,
    }));
  }

  /**
   * Remove/unregister authenticator
   */
  unregisterAuthenticator(userId, authenticatorId) {
    const authenticators = this.authenticatorDevices.get(userId) || [];
    const index = authenticators.findIndex(a => a.id === authenticatorId);

    if (index === -1) {
      throw new AuthenticatorNotFoundError(`Authenticator not found`);
    }

    const removed = authenticators.splice(index, 1)[0];
    return {
      id: removed.id,
      name: removed.name,
      unregisteredAt: Date.now(),
    };
  }

  /**
   * Generate TOTP backup codes for recovery
   * User should store these securely
   */
  generateBackupCodes(userId, count = 10) {
    const codes = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    // Store hashed backup codes (in production, store securely)
    // For now, just return them for user to save

    return {
      userId,
      backupCodes: codes,
      generatedAt: Date.now(),
      message: 'Save these codes in a secure location. Each code can be used once.',
    };
  }

  /**
   * Verify backup code as fallback for lost authenticator
   */
  verifyBackupCode(userId, code, backupCodes) {
    const codeIndex = backupCodes.findIndex(c => c === code);

    if (codeIndex === -1) {
      throw new InvalidBackupCodeError('Backup code is invalid');
    }

    // Remove used code
    backupCodes.splice(codeIndex, 1);

    return {
      valid: true,
      remaining: backupCodes.length,
      message: `Backup code accepted. ${backupCodes.length} codes remaining.`,
    };
  }

  /**
   * @private - Verify TOTP code
   */
  _verifyTOTP(sharedSecret, totpCode, timeStep, digits) {
    if (!totpCode || totpCode.length !== digits) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000 / timeStep);

    // Check current and adjacent time windows for time sync issues
    for (let window = -1; window <= 1; window++) {
      const counter = now + window;
      const hmac = crypto.createHmac('sha1', Buffer.from(sharedSecret, 'hex'));
      hmac.update(Buffer.allocUnsafe(8));

      const bufferArray = Buffer.allocUnsafe(8);
      for (let i = 7; i >= 0; --i) {
        bufferArray[i] = counter & 0xff;
        counter >>>= 8;
      }

      hmac.update(bufferArray);
      const digest = hmac.digest();

      const offset = digest[digest.length - 1] & 0xf;
      const code = (
        ((digest[offset] & 0x7f) << 24)
        | ((digest[offset + 1] & 0xff) << 16)
        | ((digest[offset + 2] & 0xff) << 8)
        | (digest[offset + 3] & 0xff)
      ) % Math.pow(10, digits);

      if (code.toString().padStart(digits, '0') === totpCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * @private - Verify HOTP code
   */
  _verifyHOTP(sharedSecret, hotpCode, counter, digits) {
    const hmac = crypto.createHmac('sha1', Buffer.from(sharedSecret, 'hex'));

    const bufferArray = Buffer.allocUnsafe(8);
    let cnt = counter;
    for (let i = 7; i >= 0; --i) {
      bufferArray[i] = cnt & 0xff;
      cnt >>>= 8;
    }

    hmac.update(bufferArray);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code = (
      ((digest[offset] & 0x7f) << 24)
      | ((digest[offset + 1] & 0xff) << 16)
      | ((digest[offset + 2] & 0xff) << 8)
      | (digest[offset + 3] & 0xff)
    ) % Math.pow(10, digits);

    return code.toString().padStart(digits, '0') === hotpCode;
  }

  /**
   * @private - Send push notification
   */
  _sendPushNotification(authenticator, challenge) {
    // In production: integrate with Firebase Cloud Messaging, Microsoft Push Notification Service, etc.
    // For now: simulate notification

    const notificationId = 'push_' + crypto.randomBytes(8).toString('hex');
    challenge.pushNotificationId = notificationId;

    // Log the notification (in production: send via real push service)
    console.log(`[Push Notification] Sent to ${authenticator.name}:`, {
      notificationId,
      challengeId: challenge.id,
      message: 'Approve this sign-in request',
      timestamp: Date.now(),
    });

    return notificationId;
  }

  /**
   * @private - Get authenticator message based on type
   */
  _getAuthenticatorMessage(type) {
    const messages = {
      TOTP: 'Enter the 6-digit code from your authenticator app',
      HOTP: 'Enter the code from your authenticator app',
      PUSH_NOTIFICATION: 'Check your phone for an approval request',
    };

    return messages[type] || 'Approve the request in your authenticator app';
  }

  /**
   * @private - Generate LPP token
   */
  _generateLPPToken(challenge) {
    return Buffer.from(
      JSON.stringify({
        challengeId: challenge.id,
        authenticatorId: challenge.authenticatorId,
        approvedAt: challenge.approvedAt,
      })
    ).toString('base64');
  }

  /**
   * @private - Calculate approval confidence
   */
  _calculateApprovalConfidence(challenge, authenticator) {
    let confidence = 0.8; // Base confidence

    // Increase confidence for older authenticators (proven track record)
    const ageDays = (Date.now() - authenticator.registeredAt) / (24 * 60 * 60 * 1000);
    confidence += Math.min(0.1, ageDays / 365 * 0.1);

    // Only push notifications are highest confidence (direct user approval)
    if (challenge.type === 'PUSH_NOTIFICATION') {
      confidence = 0.95;
    }

    // TOTP without failures is high confidence
    if (authenticator.failureCount === 0 && challenge.type === 'TOTP') {
      confidence = 0.9;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * @private - Get challenge record
   */
  _getChallengeRecord(challengeId) {
    if (!this.lppChallenges.has(challengeId)) {
      throw new ChallengeNotFoundError(`Challenge ${challengeId} not found`);
    }

    return this.lppChallenges.get(challengeId);
  }

  /**
   * @private - Get authenticator record
   */
  _getAuthenticatorRecord(userId, authenticatorId) {
    const authenticators = this.authenticatorDevices.get(userId) || [];
    const authenticator = authenticators.find(a => a.id === authenticatorId);

    if (!authenticator) {
      throw new AuthenticatorNotFoundError(
        `Authenticator ${authenticatorId} not found for user ${userId}`
      );
    }

    return authenticator;
  }
}

/**
 * LPP Error Classes
 */
class NoAuthenticatorsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NoAuthenticatorsError';
    this.code = 'NO_AUTHENTICATORS';
  }
}

class ChallengeNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChallengeNotFoundError';
    this.code = 'CHALLENGE_NOT_FOUND';
  }
}

class AuthenticatorNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticatorNotFoundError';
    this.code = 'AUTHENTICATOR_NOT_FOUND';
  }
}

class InvalidChallengeStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidChallengeStateError';
    this.code = 'INVALID_CHALLENGE_STATE';
  }
}

class LPPChallengeExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LPPChallengeExpiredError';
    this.code = 'LPP_CHALLENGE_EXPIRED';
  }
}

class InvalidTOTPError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidTOTPError';
    this.code = 'INVALID_TOTP';
  }
}

class InvalidHOTPError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidHOTPError';
    this.code = 'INVALID_HOTP';
  }
}

class PushNotificationRejectedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PushNotificationRejectedError';
    this.code = 'PUSH_NOTIFICATION_REJECTED';
  }
}

class InvalidBackupCodeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidBackupCodeError';
    this.code = 'INVALID_BACKUP_CODE';
  }
}

export {
  LocalProofOfPresenceService,
  NoAuthenticatorsError,
  ChallengeNotFoundError,
  AuthenticatorNotFoundError,
  InvalidChallengeStateError,
  LPPChallengeExpiredError,
  InvalidTOTPError,
  InvalidHOTPError,
  PushNotificationRejectedError,
  InvalidBackupCodeError,
};
