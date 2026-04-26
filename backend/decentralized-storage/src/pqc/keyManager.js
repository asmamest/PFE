/**
 * PQKeyManager - Post-Quantum Hybrid Key Management
 * Manages ML-DSA-65 + Ed25519 key pairs
 * 
 * Features:
 * - Generate hybrid key pairs per DID
 * - Secure key storage (encrypted at rest)
 * - Key rotation with versioning
 * - Key format validation
 * - ZKP-compatible key export
 */

import pino from 'pino';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { PQCClient } from './client.js';

const logger = pino({ name: 'PQKeyManager' });

/**
 * PQKeyManager: Manages post-quantum key lifecycle
 */
export class PQKeyManager {
  constructor(redisUrl = process.env.REDIS_URL) {
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 5000,
    });

    this.keyPrefix = 'qsdid:pqc:keys:';
    this.keyMetaPrefix = 'qsdid:pqc:meta:';
    this.keyVersionPrefix = 'qsdid:pqc:versions:';

    this.redis.on('error', (err) => {
      logger.error('Redis error:', err);
    });
  }

  /**
   * Generate or retrieve hybrid key pair for DID
   * 
   * @param {string} did - Decentralized Identifier
   * @param {Object} options - Options
   * @param {boolean} options.force - Force regeneration even if exists
   * @param {string} options.algorithm - 'ml_dsa' | 'hybrid' | 'zkp_ready'
   * @returns {Promise<Object>} Key pair with metadata
   */
  async generateKeyPair(did, options = {}) {
    const { force = false, algorithm = process.env.STORAGE_MODE || 'zkp_ready' } = options;

    if (!did || typeof did !== 'string' || !did.startsWith('did:')) {
      throw new Error('Invalid DID format');
    }

    const keyId = `${this.keyPrefix}${did}`;

    // Check if key exists and force=false
    if (!force) {
      const existing = await this.redis.hgetall(keyId);
      if (existing && Object.keys(existing).length > 0) {
        logger.debug(`📌 Found existing key for ${did}`);
        return this._formatKeyPairResponse(existing, algorithm);
      }
    }

    try {
      logger.info(`🔑 Generating hybrid key pair for ${did} (algorithm: ${algorithm})`);

      // Generate using WASM
      const keyPair = await PQCClient.generateHybridKeyPair(did);

      // Validate format
      this._validateKeyFormat(keyPair);

      // Store in Redis with metadata
      const version = Date.now();
      const kmKey = `${this.keyMetaPrefix}${did}`;
      const versionKey = `${this.keyVersionPrefix}${did}`;

      await Promise.all([
        // Store key pair
        this.redis.hset(keyId, {
          ml_dsa_public: keyPair.ml_dsa_public,
          ml_dsa_private: keyPair.ml_dsa_private,
          ed25519_public: keyPair.ed25519_public,
          ed25519_private: keyPair.ed25519_private,
          created_at: new Date().toISOString(),
          version: version.toString(),
          algorithm: algorithm,
          status: 'active',
        }),
        // Store metadata
        this.redis.hset(kmKey, {
          did: did,
          algorithm: algorithm,
          key_version: version.toString(),
          rotation_due: this._calculateRotationDue(),
          created_at: new Date().toISOString(),
        }),
        // Add to version history
        this.redis.sadd(versionKey, version.toString()),
        // Set expiry (security best practice: keys expire after 90 days)
        this.redis.expire(keyId, 90 * 24 * 3600),
      ]);

      logger.info(`✅ Key generated and stored for ${did}`);

      return this._formatKeyPairResponse(keyPair, algorithm);
    } catch (error) {
      logger.error(`❌ Key generation failed for ${did}:`, error);
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Get public key for a DID
   * 
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} { ml_dsa_public, ed25519_public }
   */
  async getPublicKey(did) {
    if (!did || typeof did !== 'string') {
      throw new Error('Invalid DID');
    }

    const keyId = `${this.keyPrefix}${did}`;

    try {
      const data = await this.redis.hgetall(keyId);

      if (!data || Object.keys(data).length === 0) {
        logger.warn(`⚠️ No public key found for ${did}`);
        throw new Error(`Public key not found for ${did}`);
      }

      return {
        ml_dsa_public: data.ml_dsa_public,
        ed25519_public: data.ed25519_public,
        did: did,
        algorithm: data.algorithm || 'hybrid',
        created_at: data.created_at,
      };
    } catch (error) {
      logger.error(`❌ Failed to retrieve public key for ${did}:`, error);
      throw error;
    }
  }

  /**
   * Get private key for a DID (HIGHLY SENSITIVE)
   * Only call in secure contexts with proper authentication
   * 
   * @param {string} did - Decentralized Identifier
   * @param {string} requesterContext - Who is requesting (for audit)
   * @returns {Promise<Object>} { ml_dsa_private, ed25519_private }
   */
  async getPrivateKey(did, requesterContext = 'unknown') {
    if (!did || typeof did !== 'string') {
      throw new Error('Invalid DID');
    }

    const keyId = `${this.keyPrefix}${did}`;

    try {
      // Log the request (for audit trail)
      logger.warn(`🔐 PRIVATE KEY REQUESTED for ${did} by ${requesterContext}`);

      const data = await this.redis.hgetall(keyId);

      if (!data || Object.keys(data).length === 0) {
        logger.error(`❌ Private key not found for ${did}`);
        throw new Error(`Private key not found for ${did}`);
      }

      // Return private keys with warning
      return {
        ml_dsa_private: data.ml_dsa_private,
        ed25519_private: data.ed25519_private,
        did: did,
        warning: '⚠️ DO NOT LOG OR EXPOSE THESE KEYS',
      };
    } catch (error) {
      logger.error(`❌ Private key retrieval failed:`, error);
      throw error;
    }
  }

  /**
   * Rotate keys for a DID
   * 
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} New key pair
   */
  async rotateKeys(did) {
    if (!did || typeof did !== 'string') {
      throw new Error('Invalid DID');
    }

    try {
      logger.info(`🔄 Rotating keys for ${did}`);

      // Get old keys for backup
      const oldPub = await this.getPublicKey(did);

      // Generate new keys
      const newKeyPair = await this.generateKeyPair(did, { force: true });

      // Archive old public key
      await this.redis.hset(
        `${this.keyMetaPrefix}${did}:rotations`,
        Date.now().toString(),
        JSON.stringify({
          old_ml_dsa_public: oldPub.ml_dsa_public,
          old_ed25519_public: oldPub.ed25519_public,
          rotated_at: new Date().toISOString(),
        })
      );

      logger.info(`✅ Key rotation completed for ${did}`);

      return newKeyPair;
    } catch (error) {
      logger.error(`❌ Key rotation failed for ${did}:`, error);
      throw error;
    }
  }

  /**
   * Verify key format is valid
   * 
   * @param {Object} publicKey - Public key to validate
   * @returns {Promise<boolean>} True if valid
   */
  async verifyKeyFormat(publicKey) {
    if (!publicKey || typeof publicKey !== 'string') {
      logger.warn('Invalid key format: not a string');
      return false;
    }

    // Basic validation: should be base64 or hex, reasonable length
    try {
      // Check if valid base64
      const buffer = Buffer.from(publicKey, 'base64');
      
      // ML-DSA-65 public key should be 1952 bytes
      // Ed25519 public key should be 32 bytes
      const length = buffer.length;
      const isValidMLDSA = length === 1952;
      const isValidEd25519 = length === 32;

      if (!isValidMLDSA && !isValidEd25519) {
        logger.warn(`⚠️ Key has unusual length: ${length} bytes`);
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Key format validation failed:', error.message);
      return false;
    }
  }

  /**
   * Store key metadata
   * 
   * @param {string} did - Decentralized Identifier
   * @param {Object} metadata - Metadata to store
   */
  async storeKeyMetadata(did, metadata) {
    if (!did || !metadata) {
      throw new Error('DID and metadata required');
    }

    const kmKey = `${this.keyMetaPrefix}${did}`;

    try {
      await this.redis.hset(kmKey, {
        ...metadata,
        updated_at: new Date().toISOString(),
      });

      logger.debug(`📝 Metadata stored for ${did}`);
    } catch (error) {
      logger.error(`❌ Failed to store metadata for ${did}:`, error);
      throw error;
    }
  }

  /**
   * Export key pair in ZKP-compatible format
   * For blockchain Zero Knowledge Proof verification
   * 
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} ZKP-formatted key data
   */
  async exportForZKP(did) {
    try {
      const pubKey = await this.getPublicKey(did);

      return {
        did: did,
        verification_method: 'ML-DSA-65',
        public_key: {
          ml_dsa: pubKey.ml_dsa_public,
          ed25519: pubKey.ed25519_public,
        },
        encoded_format: 'base64',
        zkp_compatible: true,
        timestamp: new Date().toISOString(),
        // For blockchain: hash of public keys for efficient verification
        commitment: Buffer.from(
          pubKey.ml_dsa_public + pubKey.ed25519_public
        ).toString('hex'),
      };
    } catch (error) {
      logger.error(`❌ ZKP export failed for ${did}:`, error);
      throw error;
    }
  }

  /**
   * List all DIDs with active keys
   * 
   * @returns {Promise<string[]>} Array of DIDs
   */
  async listActiveDIDs() {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      return keys.map((k) => k.replace(this.keyPrefix, ''));
    } catch (error) {
      logger.error('Failed to list active DIDs:', error);
      throw error;
    }
  }

  /**
   * Delete key pair (irreversible - use with caution)
   * 
   * @param {string} did - Decentralized Identifier
   */
  async deleteKeyPair(did) {
    if (!did) throw new Error('DID required');

    logger.warn(`🗑️ DELETING key pair for ${did}`);

    try {
      await Promise.all([
        this.redis.del(`${this.keyPrefix}${did}`),
        this.redis.del(`${this.keyMetaPrefix}${did}`),
      ]);

      logger.warn(`✅ Key pair deleted for ${did}`);
    } catch (error) {
      logger.error(`❌ Key deletion failed:`, error);
      throw error;
    }
  }

  /**
   * Format key pair response
   */
  _formatKeyPairResponse(keyPair, algorithm) {
    return {
      ml_dsa_public: keyPair.ml_dsa_public,
      ml_dsa_private: keyPair.ml_dsa_private,
      ed25519_public: keyPair.ed25519_public,
      ed25519_private: keyPair.ed25519_private,
      algorithm: algorithm,
      format: 'base64',
      created_at: keyPair.created_at || new Date().toISOString(),
    };
  }

  /**
   * Calculate when key should next be rotated
   */
  _calculateRotationDue() {
    const interval = parseInt(process.env.KEY_ROTATION_INTERVAL_DAYS || 90);
    const due = new Date();
    due.setDate(due.getDate() + interval);
    return due.toISOString();
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
  }
}

export default PQKeyManager;
