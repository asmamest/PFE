/**
 * Key Management Service
 * 
 * Manages device-bound cryptographic keys:
 * - Key pair generation (asymmetric)
 * - Secure key storage simulation (TPM/Secure Enclave)
 * - Signature creation and verification
 * - Key rotation policies
 * 
 * NOTE: In production, keys would be stored in TPM/Secure Enclave
 * This implementation provides a non-exportable key storage simulation
 */

import crypto from 'crypto';

export class KeyManagementService {
  constructor(options = {}) {
    // Non-exportable private key storage
    // In production: backed by TPM or Secure Enclave
    this.deviceKeys = new Map(); // deviceId -> { publicKey, privateKeyHash, metadata }
    this.keyRotationPolicy = options.keyRotationPolicy || 90 * 24 * 60 * 60 * 1000; // 90 days
    this.maxKeysPerDevice = options.maxKeysPerDevice || 5;
  }

  /**
   * Generate FIDO-like device-bound key pair
   * 
   * In production scenario:
   * - Private key generated in TPM/Secure Enclave
   * - Private key never exported
   * - Only public key and attestation returned
   */
  generateDeviceKeyPair(deviceIdentifier, metadata = {}) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1', // P-256, FIDO2 standard curve
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    const keyId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    // Simulate non-exportable storage
    // In production: send privateKey to TPM, receive attestation
    const keyRecord = {
      keyId,
      deviceIdentifier,
      publicKey,
      
      // Simulate secure storage
      _privateKeyHash: this._hashPrivateKey(privateKey),
      _privateKeySigningCapability: true, // Can be used for signing, not for export
      
      createdAt: timestamp,
      expiresAt: timestamp + this.keyRotationPolicy,
      isActive: true,
      rotations: 0,
      
      // Attestation data (in production: from TPM/SE)
      attestation: {
        type: 'simulated',
        hardware: metadata.hardware || 'software', // In production: TPM2.0, SecureEnclave, etc.
        timestamp,
      },
      
      // Metadata
      metadata: {
        osType: metadata.osType || 'unknown',
        deviceModel: metadata.deviceModel || 'unknown',
        bindingTime: timestamp,
      },
      
      // Usage tracking
      signatureCount: 0,
      lastUsed: null,
    };

    // Store device keys
    if (!this.deviceKeys.has(deviceIdentifier)) {
      this.deviceKeys.set(deviceIdentifier, []);
    }

    const deviceKeyList = this.deviceKeys.get(deviceIdentifier);
    
    // Enforce max keys per device
    if (deviceKeyList.length >= this.maxKeysPerDevice) {
      throw new KeyStorageFullError(
        `Device ${deviceIdentifier} has reached maximum key limit (${this.maxKeysPerDevice})`
      );
    }

    // Keep private key only in secure context
    this._storePrivateKeySecurely(keyId, privateKey);
    
    deviceKeyList.push(keyRecord);

    return {
      keyId,
      publicKey,
      createdAt: timestamp,
      expiresAt: keyRecord.expiresAt,
      attestation: keyRecord.attestation,
      deviceIdentifier,
      // NOTE: privateKey is NOT returned - it stays in secure storage
    };
  }

  /**
   * Create digital signature of challenge using device private key
   * 
   * The private key is never exported; only signing capability is allowed
   */
  signChallenge(deviceIdentifier, keyId, challenge) {
    const keyRecord = this._getKeyRecord(deviceIdentifier, keyId);
    
    if (!keyRecord.isActive) {
      throw new InactiveKeyError(`Key ${keyId} is not active`);
    }

    if (Date.now() > keyRecord.expiresAt) {
      keyRecord.isActive = false;
      throw new ExpiredKeyError(`Key ${keyId} has expired`);
    }

    // Retrieve private key from secure storage
    const privateKey = this._retrievePrivateKeyFromSecureStorage(keyId);
    
    // Sign the challenge
    const signature = this._createSignature(privateKey, challenge);

    // Update usage metadata
    keyRecord.signatureCount += 1;
    keyRecord.lastUsed = Date.now();

    return {
      keyId,
      signature,
      algorithm: 'ECDSA-SHA256',
      deviceIdentifier,
      timestamp: Date.now(),
    };
  }

  /**
   * Verify signature using stored public key
   * Server-side verification
   */
  verifySignature(deviceIdentifier, keyId, challenge, signature) {
    const keyRecord = this._getKeyRecord(deviceIdentifier, keyId);

    if (!keyRecord.isActive) {
      throw new InactiveKeyError(`Key ${keyId} is not active`);
    }

    try {
      const verifier = crypto.createVerify('sha256');
      verifier.update(challenge);
      const isValid = verifier.verify(keyRecord.publicKey, signature, 'hex');

      return {
        valid: isValid,
        keyId,
        deviceIdentifier,
        verifiedAt: Date.now(),
      };
    } catch (error) {
      throw new SignatureVerificationError(`Failed to verify signature: ${error.message}`);
    }
  }

  /**
   * Get key metadata (public information only)
   */
  getKeyMetadata(deviceIdentifier, keyId) {
    const keyRecord = this._getKeyRecord(deviceIdentifier, keyId);

    // Return only non-sensitive metadata
    return {
      keyId,
      deviceIdentifier,
      isActive: keyRecord.isActive,
      createdAt: keyRecord.createdAt,
      expiresAt: keyRecord.expiresAt,
      signatureCount: keyRecord.signatureCount,
      lastUsed: keyRecord.lastUsed,
      metadata: keyRecord.metadata,
      attestation: keyRecord.attestation,
      // NOTE: publicKey is NOT returned here - use when needed explicitly
    };
  }

  /**
   * Get public key for verification
   */
  getPublicKey(deviceIdentifier, keyId) {
    const keyRecord = this._getKeyRecord(deviceIdentifier, keyId);
    return keyRecord.publicKey;
  }

  /**
   * Rotate key (revoke old, issue new)
   */
  rotateKey(deviceIdentifier, keyId) {
    const oldKeyRecord = this._getKeyRecord(deviceIdentifier, keyId);
    
    oldKeyRecord.isActive = false;
    oldKeyRecord.revokedAt = Date.now();
    oldKeyRecord.revocationReason = 'Key rotation';

    // Generate new key
    const newKeyPair = this.generateDeviceKeyPair(deviceIdentifier, oldKeyRecord.metadata);

    return {
      oldKeyId: keyId,
      newKeyId: newKeyPair.keyId,
      newPublicKey: newKeyPair.publicKey,
      rotatedAt: Date.now(),
    };
  }

  /**
   * List all keys for a device
   */
  listDeviceKeys(deviceIdentifier) {
    const deviceKeyList = this.deviceKeys.get(deviceIdentifier) || [];
    
    return deviceKeyList.map(k => ({
      keyId: k.keyId,
      isActive: k.isActive,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      signatureCount: k.signatureCount,
      lastUsed: k.lastUsed,
    }));
  }

  /**
   * Revoke key immediately
   */
  revokeKey(deviceIdentifier, keyId, reason = 'User requested revocation') {
    const keyRecord = this._getKeyRecord(deviceIdentifier, keyId);
    keyRecord.isActive = false;
    keyRecord.revokedAt = Date.now();
    keyRecord.revocationReason = reason;

    return {
      keyId,
      revokedAt: keyRecord.revokedAt,
      revocationReason: reason,
    };
  }

  /**
   * ===== PRIVATE METHODS (Secure Storage Simulation) =====
   */

  /**
   * @private
   * In production: store in TPM/Secure Enclave
   */
  _storePrivateKeySecurely(keyId, privateKey) {
    // Simulate non-exportable storage
    // In real implementation: call TPM Bind operation
    this._secureStorage = this._secureStorage || new Map();
    this._secureStorage.set(keyId, {
      key: privateKey,
      storedAt: Date.now(),
      locked: true, // Cannot be exported
    });
  }

  /**
   * @private
   * In production: retrieve signing capability from TPM
   */
  _retrievePrivateKeyFromSecureStorage(keyId) {
    if (!this._secureStorage || !this._secureStorage.has(keyId)) {
      throw new KeyNotFoundError(`Cannot access key ${keyId} from secure storage`);
    }

    return this._secureStorage.get(keyId).key;
  }

  /**
   * @private
   * Hash private key for storage metadata (never store actual key)
   */
  _hashPrivateKey(privateKey) {
    return crypto.createHash('sha256').update(privateKey).digest('hex').substring(0, 16);
  }

  /**
   * @private
   * Create ECDSA signature of challenge
   */
  _createSignature(privateKey, challenge) {
    const signer = crypto.createSign('sha256');
    signer.update(challenge);
    return signer.sign(privateKey, 'hex');
  }

  /**
   * @private
   * Get key record with validation
   */
  _getKeyRecord(deviceIdentifier, keyId) {
    const deviceKeyList = this.deviceKeys.get(deviceIdentifier);

    if (!deviceKeyList) {
      throw new DeviceNotFoundError(`Device ${deviceIdentifier} not found`);
    }

    const keyRecord = deviceKeyList.find(k => k.keyId === keyId);

    if (!keyRecord) {
      throw new KeyNotFoundError(`Key ${keyId} not found for device ${deviceIdentifier}`);
    }

    return keyRecord;
  }
}

/**
 * Custom key management errors
 */
class KeyStorageFullError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyStorageFullError';
    this.code = 'KEY_STORAGE_FULL';
  }
}

class InactiveKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InactiveKeyError';
    this.code = 'INACTIVE_KEY';
  }
}

class ExpiredKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExpiredKeyError';
    this.code = 'EXPIRED_KEY';
  }
}

class SignatureVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignatureVerificationError';
    this.code = 'SIGNATURE_VERIFICATION_FAILED';
  }
}

class DeviceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeviceNotFoundError';
    this.code = 'DEVICE_NOT_FOUND';
  }
}

class KeyNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyNotFoundError';
    this.code = 'KEY_NOT_FOUND';
  }
}

export {
  KeyStorageFullError,
  InactiveKeyError,
  ExpiredKeyError,
  SignatureVerificationError,
  DeviceNotFoundError,
  KeyNotFoundError,
};
