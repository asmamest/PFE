/**
 * Identity Service
 * 
 * Manages decentralized identities (DIDs) and user profiles:
 * - DID generation and management (DID:QSDID format)
 * - Identity binding to public keys and wallets
 * - User profile management
 * - Device binding and tracking
 * - Identity metadata
 */

import { v4 as uuidv4 } from 'uuid';

export class IdentityService {
  constructor(options = {}) {
    this.identities = new Map(); // identityId -> identity record
    this.didRegistry = new Map(); // did -> identityId (reverse lookup)
    this.deviceRegistry = new Map(); // deviceIdentifier -> identityId[]
    this.didFormat = options.didFormat || 'qsdid'; // Decentralized ID format
  }

  /**
   * Create new decentralized identity
   * Binds together: DID, public key, device, and metadata
   */
  createIdentity(publicKey, deviceIdentifier, walletAddress, metadata = {}) {
    const identityId = uuidv4();
    const timestamp = Date.now();

    // Generate DID (Decentralized Identifier)
    const did = this._generateDID(identityId);

    const identity = {
      identityId,
      did,
      created: timestamp,
      updated: timestamp,
      
      // Cryptographic binding
      publicKey,
      keyId: null, // Will be set during authentication
      
      // Web3 binding
      walletAddress,
      primaryWallet: walletAddress,
      walletBindingTime: timestamp,
      
      // Device binding (pseudonymous, non-tracking)
      boundDevices: [
        {
          deviceIdentifier,
          boundAt: timestamp,
          isPrimary: true,
          lastSeen: timestamp,
          usageCount: 0,
        }
      ],
      
      // Metadata
      metadata: {
        creationContext: metadata.context || 'registration',
        creationIpContext: metadata.ipContext || 'unknown',
        registrationMethod: 'FIDO-like',
        ...metadata,
      },
      
      // Status tracking
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      isPublic: false, // DID visibility
      
      // Recovery and security
      recoveryKeys: [],
      delegatedKeys: [],
      
      // Audit trail
      activityLog: [
        {
          event: 'IDENTITY_CREATED',
          timestamp,
          details: { method: 'registration' },
        }
      ],
      
      // Profile information (optional)
      profile: {
        displayName: null,
        email: null,
        phoneNumber: null,
      },
    };

    this.identities.set(identityId, identity);
    this.didRegistry.set(did, identityId);
    
    // Index device
    if (!this.deviceRegistry.has(deviceIdentifier)) {
      this.deviceRegistry.set(deviceIdentifier, []);
    }
    this.deviceRegistry.get(deviceIdentifier).push(identityId);

    return {
      identityId,
      did,
      created: timestamp,
      publicKey,
      walletAddress,
      status: identity.status,
    };
  }

  /**
   * Retrieve identity by ID
   */
  getIdentity(identityId) {
    const identity = this.identities.get(identityId);

    if (!identity) {
      throw new IdentityNotFoundError(`Identity ${identityId} not found`);
    }

    if (identity.status === 'REVOKED') {
      throw new IdentityRevokedError(`Identity ${identityId} has been revoked`);
    }

    return identity;
  }

  /**
   * Retrieve identity by DID
   */
  getIdentityByDID(did) {
    const identityId = this.didRegistry.get(did);

    if (!identityId) {
      throw new DIDNotFoundError(`DID ${did} not found`);
    }

    return this.getIdentity(identityId);
  }

  /**
   * Bind additional device to identity
   */
  bindDevice(identityId, deviceIdentifier, metadata = {}) {
    const identity = this.getIdentity(identityId);

    // Check if device already bound
    const existingDevice = identity.boundDevices.find(
      d => d.deviceIdentifier === deviceIdentifier
    );

    if (existingDevice) {
      existingDevice.lastSeen = Date.now();
      existingDevice.usageCount += 1;

      return {
        identityId,
        deviceIdentifier,
        alreadyBound: true,
        lastSeen: existingDevice.lastSeen,
      };
    }

    // Bind new device
    const newDevice = {
      deviceIdentifier,
      boundAt: Date.now(),
      isPrimary: false,
      lastSeen: Date.now(),
      usageCount: 1,
      metadata,
    };

    identity.boundDevices.push(newDevice);
    identity.updated = Date.now();

    // Index device
    if (!this.deviceRegistry.has(deviceIdentifier)) {
      this.deviceRegistry.set(deviceIdentifier, []);
    }
    if (!this.deviceRegistry.get(deviceIdentifier).includes(identityId)) {
      this.deviceRegistry.get(deviceIdentifier).push(identityId);
    }

    this._logActivity(identityId, 'DEVICE_BOUND', { deviceIdentifier });

    return {
      identityId,
      deviceIdentifier,
      alreadyBound: false,
      boundAt: newDevice.boundAt,
    };
  }

  /**
   * Update identity profile information
   */
  updateProfile(identityId, profileData) {
    const identity = this.getIdentity(identityId);

    // Only allow non-sensitive updates
    const allowedFields = ['displayName', 'email', 'phoneNumber'];
    
    for (const field of allowedFields) {
      if (field in profileData) {
        identity.profile[field] = profileData[field];
      }
    }

    identity.updated = Date.now();
    this._logActivity(identityId, 'PROFILE_UPDATED', { fields: Object.keys(profileData) });

    return {
      identityId,
      profile: identity.profile,
      updated: identity.updated,
    };
  }

  /**
   * Verify identity status
   */
  verifyIdentityStatus(identityId) {
    try {
      const identity = this.getIdentity(identityId);

      return {
        identityId,
        did: identity.did,
        status: identity.status,
        verificationStatus: identity.verificationStatus,
        created: identity.created,
        lastActivity: identity.updated,
        boundDeviceCount: identity.boundDevices.length,
        boundWalletCount: 1, // Currently supports one primary
      };
    } catch (error) {
      return {
        identityId,
        status: 'NOT_FOUND',
        error: error.message,
      };
    }
  }

  /**
   * Add recovery key for security
   */
  addRecoveryKey(identityId, recoveryKey) {
    const identity = this.getIdentity(identityId);

    const recovery = {
      keyId: uuidv4(),
      key: recoveryKey,
      addedAt: Date.now(),
      isActive: true,
      usageCount: 0,
    };

    identity.recoveryKeys.push(recovery);
    identity.updated = Date.now();

    this._logActivity(identityId, 'RECOVERY_KEY_ADDED', { keyId: recovery.keyId });

    return {
      identityId,
      recoveryKeyId: recovery.keyId,
      addedAt: recovery.addedAt,
    };
  }

  /**
   * Revoke identity (irreversible)
   */
  revokeIdentity(identityId, reason = 'User requested') {
    const identity = this.getIdentity(identityId);

    identity.status = 'REVOKED';
    identity.updated = Date.now();
    identity.revocationReason = reason;
    identity.revokedAt = Date.now();

    this._logActivity(identityId, 'IDENTITY_REVOKED', { reason });

    return {
      identityId,
      status: 'REVOKED',
      revokedAt: identity.revokedAt,
    };
  }

  /**
   * Get device-associated identities
   */
  getIdentitiesByDevice(deviceIdentifier) {
    const identityIds = this.deviceRegistry.get(deviceIdentifier) || [];
    
    return identityIds
      .map(id => {
        try {
          const identity = this.getIdentity(id);
          return {
            identityId: id,
            did: identity.did,
            status: identity.status,
            created: identity.created,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Export DID document (for blockchain/distributed systems)
   */
  exportDIDDocument(identityId) {
    const identity = this.getIdentity(identityId);

    return {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: identity.did,
      publicKey: [
        {
          id: `${identity.did}#key-1`,
          type: 'EcdsaSecp256r1VerificationKey2019',
          controller: identity.did,
          publicKeyPem: identity.publicKey,
        }
      ],
      authentication: [
        `${identity.did}#key-1`
      ],
      service: [
        {
          id: `${identity.did}#web3`,
          type: 'Web3Account',
          serviceEndpoint: identity.walletAddress,
        }
      ],
      created: new Date(identity.created).toISOString(),
      updated: new Date(identity.updated).toISOString(),
      proof: {
        type: 'EcdsaSecp256r1Signature2019',
        created: new Date(identity.created).toISOString(),
        verificationMethod: `${identity.did}#key-1`,
        signatureValue: 'TODO: add proof',
      },
    };
  }

  /**
   * ===== PRIVATE METHODS =====
   */

  /**
   * @private
   * Generate DID in QSDID format
   */
  _generateDID(identityId) {
    const shortId = identityId.split('-')[0];
    return `did:${this.didFormat}:${shortId}`;
  }

  /**
   * @private
   * Log activity to identity audit trail
   */
  _logActivity(identityId, event, details = {}) {
    const identity = this.identities.get(identityId);
    
    if (identity) {
      identity.activityLog.push({
        event,
        timestamp: Date.now(),
        details,
      });

      // Keep only last 100 activities
      if (identity.activityLog.length > 100) {
        identity.activityLog.shift();
      }

      identity.updated = Date.now();
    }
  }

  /**
   * List all identities (admin only)
   */
  listIdentities(filter = {}) {
    const identities = Array.from(this.identities.values());

    let filtered = identities;

    if (filter.status) {
      filtered = filtered.filter(i => i.status === filter.status);
    }

    if (filter.verificationStatus) {
      filtered = filtered.filter(i => i.verificationStatus === filter.verificationStatus);
    }

    return filtered.map(i => ({
      identityId: i.identityId,
      did: i.did,
      created: i.created,
      status: i.status,
      boundDeviceCount: i.boundDevices.length,
    }));
  }
}

/**
 * Custom identity errors
 */
class IdentityNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdentityNotFoundError';
    this.code = 'IDENTITY_NOT_FOUND';
  }
}

class IdentityRevokedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdentityRevokedError';
    this.code = 'IDENTITY_REVOKED';
  }
}

class DIDNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DIDNotFoundError';
    this.code = 'DID_NOT_FOUND';
  }
}

export {
  IdentityNotFoundError,
  IdentityRevokedError,
  DIDNotFoundError,
};
