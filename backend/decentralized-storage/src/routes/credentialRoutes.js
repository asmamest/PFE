/**
 * Credential Routes - Post-Quantum Version (v2.0)
 * 
 * CRITICAL DESIGN:
 * ✅ ALL signatures use ML-DSA-65 (mandatory)
 * ✅ NO ENCRYPTION - Credentials stored plain on IPFS
 * ✅ MANDATORY VERIFICATION - Every retrieve checks signature
 * ✅ ZKP-READY - All endpoints support blockchain integration
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import storeCredential from '../credential/store.js';
import {
  retrieveCredential,
  verifyCredential,
  retrieveCredentialForZKP,
  retrieveCredentialsBatch,
} from '../credential/retrieve.js';
import { getPaginatedCredentials } from '../provider/credentialIndex.js';
import {
  validateDIDMiddleware,
  sanitizeSensitiveData,
  createDIDRateLimiter,
  auditLogMiddleware,
  validatePQPayload,
  enforceNoEncryption,
  pqErrorHandler,
  enforceStrictVerification,
} from '../middleware/pqAuth.js';

const logger = pino({ name: 'CredentialRoutes' });
const router = Router();

// Apply security middleware to all routes
router.use(sanitizeSensitiveData);
router.use(enforceStrictVerification);
router.use(enforceNoEncryption);
router.use(auditLogMiddleware);

const didRateLimiter = createDIDRateLimiter();

// ============================================
// POST /store - Store credential with PQ signature
// ============================================
router.post(
  '/store',
  validateDIDMiddleware,
  validatePQPayload,
  didRateLimiter,
  async (req, res) => {
    const credentialId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info(`🔐 [POST /store] Storing credential for ${req.did}`);

      const { claims, metadata, privateKey, image } = req.body;

      if (!claims || typeof claims !== 'object') {
        return res.status(400).json({
          error: 'Invalid claims: must be a JSON object',
        });
      }
      if (!privateKey || typeof privateKey !== 'string') {
        return res.status(400).json({
          error: 'Invalid privateKey: must be base64 string',
        });
      }

      const result = await storeCredential({
        claims,
        metadata: {
          ...metadata,
          issuer_did: req.did,
        },
        did: req.did,
        privateKey,
        image: image ? Buffer.from(image, 'base64') : null,
        credentialId,
      });

      const duration = Date.now() - startTime;

      logger.info(`✅ Credential stored successfully`, {
        cid: result.cid,
        issuer_did: req.did,
        duration_ms: duration,
      });

      return res.status(201).json({
        success: true,
        credential_id: credentialId,
        cid: result.cid,
        signature_id: result.signature_id,
        claims_hash: result.claims_hash,
        algorithm: result.algorithm,
        encryption: result.encryption,
        zkp_compatible: result.zkp_compatible,
        storage_time_ms: result.storage_time_ms,
        message: 'Credential stored with valid ML-DSA-65 signature',
      });
    } catch (error) {
      logger.error(`❌ [POST /store] Error:`, error);
      return res.status(500).json({
        error: error.message,
        credential_id: credentialId,
      });
    }
  }
);

// ============================================
// GET /retrieve/:cid - Retrieve credential with PQ verification
// ============================================
router.get('/retrieve/:cid', async (req, res) => {
  const { cid } = req.params;
  const { include_proof, zkp_format } = req.query;
  const startTime = Date.now();

  try {
    logger.info(`🔍 [GET /retrieve] Retrieving credential: ${cid}`);

    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({
        error: 'Invalid CID format',
      });
    }

    const result = await retrieveCredential(cid, {
      includeProof: include_proof === 'true',
      issuerPublicKey: null,
    });

    const duration = Date.now() - startTime;

    logger.info(`✅ Credential retrieved and verified in ${duration}ms`);

    return res.json({
      success: true,
      cid: result.cid,
      credential: {
        claims: result.claims,
        metadata: result.metadata,
      },
      verification: {
        valid: result.verified,
        status: result.verification.status,
        algorithm: 'ML-DSA-65',
        verified_at: result.verification.verified_at,
        issuer_did: result.verification.issuer_did,
      },
      ...(include_proof && { verification_report: result.verification_report }),
      ...(zkp_format && { zkp_proof: result.zkp_proof }),
      retrieval_time_ms: duration,
      message: '✅ Credential verified - Safe to use',
    });
  } catch (error) {
    logger.warn(`⚠️ [GET /retrieve] Error: ${error.message}`);
    const statusCode = error.message.includes('REJECTED') ? 403 : 500;
    return res.status(statusCode).json({
      error: error.message,
      cid: cid,
    });
  }
});

// ============================================
// POST /verify/:cid - Verify signature only
// ============================================
router.post('/verify/:cid', async (req, res) => {
  const { cid } = req.params;

  try {
    logger.info(`🔐 [POST /verify] Verifying signature for: ${cid}`);

    if (!cid) {
      return res.status(400).json({ error: 'CID required' });
    }

    const verification = await verifyCredential(cid, {
      includeProof: true,
    });

    const statusCode = verification.valid ? 200 : 403;

    return res.status(statusCode).json({
      success: verification.valid,
      cid: cid,
      verification: verification,
    });
  } catch (error) {
    logger.error(`❌ [POST /verify] Error:`, error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// ============================================
// GET /credentials - List credentials with pagination
// ============================================
router.get('/credentials', async (req, res) => {
  try {
    const { did, page = 1, limit = 20 } = req.query;

    if (!did || typeof did !== 'string') {
      return res.status(400).json({
        error: 'DID required as query parameter',
        example: '?did=did:example:123456',
      });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    logger.info(`📋 [GET /credentials] Listing for ${did} (page ${pageNum})`);

    const result = await getPaginatedCredentials(did, pageNum, limitNum);

    return res.json({
      success: true,
      did: did,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        has_more: result.hasMore,
      },
      credentials: result.credentials || [],
      links: {
        self: `/credentials?did=${did}&page=${pageNum}&limit=${limitNum}`,
        next: result.hasMore ? `/credentials?did=${did}&page=${pageNum + 1}&limit=${limitNum}` : null,
      },
    });
  } catch (error) {
    logger.error(`❌ [GET /credentials] Error:`, error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// ============================================
// POST /export-zkp/:cid - Export for ZKP
// ============================================
router.post('/export-zkp/:cid', async (req, res) => {
  const { cid } = req.params;

  try {
    logger.info(`📜 [POST /export-zkp] Exporting for ZKP: ${cid}`);

    if (!cid) {
      return res.status(400).json({ error: 'CID required' });
    }

    const zkpData = await retrieveCredentialForZKP(cid);

    return res.json({
      success: true,
      zkp_export: zkpData,
      export_format: 'dag-cbor',
      compatible_chains: ['ethereum', 'polygon', 'arbitrum'],
    });
  } catch (error) {
    logger.error(`❌ [POST /export-zkp] Error:`, error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// ============================================
// POST /retrieve-batch - Batch retrieve
// ============================================
router.post('/retrieve-batch', async (req, res) => {
  try {
    const { cids } = req.body;

    if (!Array.isArray(cids) || cids.length === 0) {
      return res.status(400).json({
        error: 'Body must contain cids array',
      });
    }

    if (cids.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 CIDs per batch',
      });
    }

    logger.info(`📦 [POST /retrieve-batch] Retrieving ${cids.length} credentials`);

    const result = await retrieveCredentialsBatch(cids);

    return res.json({
      success: true,
      summary: {
        total: result.total,
        retrieved: result.retrieved,
        failed: result.failed,
        success_rate: `${((result.retrieved / result.total) * 100).toFixed(1)}%`,
      },
      results: result.results,
    });
  } catch (error) {
    logger.error(`❌ [POST /retrieve-batch] Error:`, error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// ============================================
// Health check
// ============================================
router.get('/health', (req, res) => {
  return res.json({
    status: 'up',
    version: '2.0.0-pq',
    features: ['ML-DSA-65', 'plaintext-storage', 'zkp-ready'],
    note: 'Post-Quantum Cryptography Version',
  });
});

router.use(pqErrorHandler);

export default router;
