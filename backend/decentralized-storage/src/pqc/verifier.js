/**
 * PQVerifier - Post-Quantum Cryptographic Verification
 * Verifies ML-DSA-65 signatures before returning credentials
 * 
 * CRITICAL: All retrieved credentials MUST pass verification
 * 
 * Features:
 * - Mandatory signature verification
 * - Two-level verification (format + crypto)
 * - Efficient hash-based verification
 * - Detailed verification reports
 * - ZKP-compatible proof generation
 * - Rejection of tampered or missing signatures
 */

import pino from 'pino';
import { createHash } from 'crypto';
import { PQCClient } from './client.js';
import { PQKeyManager } from './keyManager.js';

const logger = pino({ name: 'PQVerifier' });

/**
 * Verification result status codes
 */
export const VerificationStatus = {
  VALID: 'VALID',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  MISSING_CLAIMS: 'MISSING_CLAIMS',
  NO_PUBLIC_KEY: 'NO_PUBLIC_KEY',
  TAMPERED_CLAIMS: 'TAMPERED_CLAIMS',
  EXPIRED: 'EXPIRED',
  VERIFICATION_ERROR: 'VERIFICATION_ERROR',
};

/**
 * PQVerifier: Verify post-quantum signatures
 */
export class PQVerifier {
  constructor() {
    this.keyManager = new PQKeyManager();
  }

  /**
   * Verify a credential signature (MANDATORY before use)
   * 
   * @param {Object} credential - Credential to verify
   * @param {Object} credential.claims - Credential claims
   * @param {Object} credential.signature - Signature metadata
   * @param {string} credential.signature.issuer_did - Issuer DID
   * @param {string} credential.signature.ml_dsa - ML-DSA-65 signature
   * @param {string} credential.signature.claims_hash - Hash of claims
   * @param {Object} options - Options
   * @param {boolean} options.throwOnFailure - Throw error if invalid
   * @param {boolean} options.includeReport - Include detailed report
   * @param {string} options.issuerPublicKey - Optional public key (skip lookup)
   * @returns {Promise<Object>} Verification result
   */
  async verify(credential, options = {}) {
    const {
      throwOnFailure = process.env.STRICT_VERIFICATION !== 'false',
      includeReport = process.env.INCLUDE_VERIFICATION_PROOF !== 'false',
      issuerPublicKey = null,
    } = options;

    const startTime = Date.now();
    const result = {
      valid: false,
      status: VerificationStatus.VERIFICATION_ERROR,
      duration_ms: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Level 1: Format Validation
      const formatCheck = this._validateFormat(credential);
      if (!formatCheck.valid) {
        result.status = formatCheck.status;
        result.error = formatCheck.error;
        result.valid = false;

        logger.warn(`⚠️ Format validation failed: ${formatCheck.error}`);

        if (includeReport) result.report = formatCheck.report;
        if (throwOnFailure) throw new Error(`Format validation failed: ${formatCheck.error}`);

        return result;
      }

      // Level 2: Claims Integrity (hash verification)
      const hashCheck = this._verifyClaimsHash(
        credential.claims,
        credential.signature.claims_hash
      );
      if (!hashCheck.valid) {
        result.status = VerificationStatus.TAMPERED_CLAIMS;
        result.error = 'Claims hash mismatch - credentials may have been tampered';
        result.valid = false;

        logger.error('❌ TAMPERED CLAIMS DETECTED');

        if (includeReport) result.report = hashCheck.report;
        if (throwOnFailure) throw new Error('Claims integrity check failed');

        return result;
      }

      // Level 3: Expiry check (if applicable)
      if (credential.signature.valid_until) {
        const expiryCheck = this._checkExpiry(credential.signature.valid_until);
        if (!expiryCheck.valid) {
          result.status = VerificationStatus.EXPIRED;
          result.error = expiryCheck.error;
          result.valid = false;

          logger.warn(`⚠️ Credential expired: ${expiryCheck.error}`);

          if (includeReport) result.report = expiryCheck.report;
          if (throwOnFailure) throw new Error(expiryCheck.error);

          return result;
        }
      }

      // Level 4: Cryptographic Signature Verification (CRITICAL)
      const issuerDid = credential.signature.issuer_did;
      let publicKey = issuerPublicKey;

      if (!publicKey) {
        try {
          const keyData = await this.keyManager.getPublicKey(issuerDid);
          publicKey = keyData.ml_dsa_public;
        } catch (err) {
          result.status = VerificationStatus.NO_PUBLIC_KEY;
          result.error = `Cannot retrieve public key for ${issuerDid}`;
          result.valid = false;

          logger.error(`❌ Public key not found for ${issuerDid}`);

          if (throwOnFailure) throw new Error(result.error);
          return result;
        }
      }

      // Perform cryptographic verification
      const cryptoVerified = await PQCClient.verify(
        credential.claims,
        credential.signature.ml_dsa,
        publicKey,
        { throwOnFailure: false }
      );

      result.duration_ms = Date.now() - startTime;

      if (!cryptoVerified) {
        result.status = VerificationStatus.INVALID_SIGNATURE;
        result.error = 'Cryptographic signature verification failed';
        result.valid = false;

        logger.error('❌ INVALID SIGNATURE - Credential rejected');

        this._recordMetric('verification_failures', 1);

        if (throwOnFailure) {
          throw new Error('Signature verification failed');
        }

        return result;
      }

      // ✅ ALL CHECKS PASSED
      result.status = VerificationStatus.VALID;
      result.valid = true;
      result.issuer_did = issuerDid;
      result.verified_at = new Date().toISOString();

      logger.info(`✅ Credential verified in ${result.duration_ms}ms (issuer: ${issuerDid})`);

      this._recordMetric('verification_success', 1);
      this._recordMetric('verification_duration', result.duration_ms);

      // Optional: Include detailed verification report
      if (includeReport) {
        result.report = {
          format_check: { valid: true },
          hash_check: { valid: true, claims_hash: credential.signature.claims_hash },
          signature_check: { valid: true, algorithm: 'ML-DSA-65' },
          expiry_check: { valid: !credential.signature.valid_until || this._checkExpiry(credential.signature.valid_until).valid },
        };
      }

      return result;
    } catch (error) {
      result.status = VerificationStatus.VERIFICATION_ERROR;
      result.error = error.message;
      result.valid = false;

      logger.error('❌ Verification error:', error);

      this._recordMetric('verification_errors', 1);

      return result;
    }
  }

  /**
   * Batch verify multiple credentials
   * 
   * @param {Object[]} credentials - Array of credentials to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} { total, valid, invalid, results }
   */
  async verifyBatch(credentials, options = {}) {
    if (!Array.isArray(credentials)) {
      throw new Error('Credentials must be an array');
    }

    logger.info(`Starting batch verification of ${credentials.length} credentials`);

    const results = [];
    let valid = 0;

    for (const cred of credentials) {
      const result = await this.verify(cred, { ...options, throwOnFailure: false });
      results.push(result);
      if (result.valid) valid++;
    }

    const batchResult = {
      total: credentials.length,
      valid: valid,
      invalid: credentials.length - valid,
      success_rate: ((valid / credentials.length) * 100).toFixed(2) + '%',
      results: results,
      timestamp: new Date().toISOString(),
    };

    logger.info(`Batch verification complete: ${valid}/${credentials.length} valid`);

    return batchResult;
  }

  /**
   * Verify ONLY the signature (used for signature-only verification)
   * Does not verify claims hash or expiry
   * 
   * @param {string} claims - Serialized claims
   * @param {string} signature - Signature (base64)
   * @param {string} publicKey - Public key
   * @returns {Promise<boolean>} True if signature valid
   */
  async verifySignatureOnly(claims, signature, publicKey) {
    try {
      const verified = await PQCClient.verify(claims, signature, publicKey, {
        throwOnFailure: false,
      });

      return verified;
    } catch (error) {
      logger.error('Signature-only verification error:', error);
      return false;
    }
  }

  /**
   * Export verification proof for ZKP circuits
   * For blockchain integration
   * 
   * @param {Object} credential - Verified credential
   * @param {Object} verificationResult - Verification result
   * @returns {Object} ZKP-compatible proof
   */
  exportZKPProof(credential, verificationResult) {
    if (!verificationResult.valid) {
      throw new Error('Cannot export proof for invalid credential');
    }

    return {
      type: 'ML-DSA-65-BBS-BlsSignatureProof2020',
      issuer_did: credential.signature.issuer_did,
      subject_did: credential.metadata?.subject_did,
      claims_hash: credential.signature.claims_hash,
      signature: credential.signature.ml_dsa,
      verified_at: verificationResult.verified_at,
      validity_proof: {
        not_before: credential.signature.timestamp,
        not_after: credential.signature.valid_until,
      },
      commitment: credential.zkp_metadata?.commitment,
      proof_format: 'dag-cbor',
      zkp_ready: true,
    };
  }

  /**
   * Validate credential format (structure only)
   */
  _validateFormat(credential) {
    const report = {
      checks: [],
    };

    // Check credential object
    if (!credential || typeof credential !== 'object') {
      return {
        valid: false,
        status: VerificationStatus.INVALID_FORMAT,
        error: 'Invalid credential: must be an object',
        report,
      };
    }

    // Check claims
    if (!credential.claims || typeof credential.claims !== 'object') {
      return {
        valid: false,
        status: VerificationStatus.MISSING_CLAIMS,
        error: 'Missing or invalid claims',
        report,
      };
    }

    // Check signature metadata
    if (!credential.signature || typeof credential.signature !== 'object') {
      return {
        valid: false,
        status: VerificationStatus.MISSING_SIGNATURE,
        error: 'Missing signature metadata',
        report,
      };
    }

    // Check required signature fields
    const requiredFields = ['issuer_did', 'ml_dsa', 'claims_hash', 'timestamp'];
    for (const field of requiredFields) {
      if (!credential.signature[field]) {
        return {
          valid: false,
          status: VerificationStatus.INVALID_FORMAT,
          error: `Missing required signature field: ${field}`,
          report,
        };
      }
    }

    report.checks.push('✅ Credential format valid');
    report.checks.push('✅ Claims present');
    report.checks.push('✅ Signature metadata complete');

    return { valid: true, report };
  }

  /**
   * Verify claims hash
   */
  _verifyClaimsHash(claims, expectedHash) {
    const claimsJson = typeof claims === 'string' ? claims : JSON.stringify(claims);

    // Try BLAKE3 first, fallback to SHA256
    let calculatedHash;
    try {
      const blake3 = require('blake3');
      calculatedHash = blake3(Buffer.from(claimsJson)).toString('hex');
    } catch (e) {
      calculatedHash = createHash('sha256')
        .update(claimsJson)
        .digest('hex');
    }

    const valid = calculatedHash === expectedHash;

    return {
      valid,
      report: {
        expected_hash: expectedHash,
        calculated_hash: calculatedHash,
        match: valid,
      },
    };
  }

  /**
   * Check credential expiry
   */
  _checkExpiry(validUntil) {
    const expiryDate = new Date(validUntil);
    const now = new Date();

    const valid = expiryDate > now;

    return {
      valid,
      error: valid ? null : `Credential expired at ${validUntil}`,
      report: {
        valid_until: validUntil,
        now: now.toISOString(),
        expired: !valid,
      },
    };
  }

  /**
   * Record metrics
   */
  _recordMetric(name, value) {
    logger.debug(`📊 ${name}: ${value}`);
  }

  /**
   * Close resources
   */
  async close() {
    if (this.keyManager) {
      await this.keyManager.close();
    }
  }
}

export default PQVerifier;
