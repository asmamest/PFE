/**
 * Store Credential - Post-Quantum Version
 * 
 * CRITICAL DESIGN CHANGES (v2.0):
 * ✅ NO ENCRYPTION - Claims stored in PLAIN on IPFS
 * ✅ ML-DSA-65 MANDATORY - Every credential must be signed
 * ✅ BLAKE3 hashing - For integrity verification
 * ✅ PLAIN-text storage - Optimized for ZKP verification
 * 
 * Storage Structure on IPFS:
 * - claims.json (plain text, NOT encrypted)
 * - metadata.json (plain text, contains signature metadata)
 * - signature.ml-dsa (base64 encoded ML-DSA-65 signature)
 * - image.bin (optional, plain binary)
 */

import { getIpfsClient } from '../ipfs/client.js';
import { enqueueCid } from '../provider/cidQueue.js';
import { startBackgroundReplication } from '../ipfs/replication.js';
import { indexCredential } from '../provider/credentialIndex.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';
import { config } from '../config.js';
import { PQSigner } from '../pqc/signer.js';
import { PQKeyManager } from '../pqc/keyManager.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Store a credential with PQ signatures (plaintext storage)
 * 
 * @param {Object} params - Storage parameters
 * @param {Object} params.claims - Credential claims (WILL BE STORED IN PLAIN)
 * @param {Object} params.metadata - Credential metadata
 * @param {string} params.did - Issuer DID (required)
 * @param {string} params.privateKey - Issuer private key for signing
 * @param {Buffer} params.image - Optional image (NOT encrypted)
 * @param {Object} params.options - Additional options
 * @returns {Promise<Object>} { cid, credentialId, signature_id, claims_hash, zkp_compatible }
 */
export async function storeCredential(params) {
  const {
    claims,
    metadata = {},
    did,
    privateKey,
    image = null,
    credentialId = uuidv4(),
    options = {},
  } = params;

  const startTime = Date.now();

  // Validation
  if (!claims || typeof claims !== 'object') {
    throw new Error('❌ Invalid claims: must be an object');
  }
  if (!did || !did.startsWith('did:')) {
    throw new Error('❌ Invalid DID format');
  }
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('❌ Invalid private key');
  }

  logger.info(`🔐 [store] Storing credential ${credentialId} from ${did}`);

  try {
    const ipfs = await getIpfsClient();
    const signer = new PQSigner();
    const keyManager = new PQKeyManager();

    // Step 1: Prepare credential object for signing
    const credentialForSigning = {
      id: credentialId,
      claims: claims, // PLAIN TEXT - NOT ENCRYPTED
      metadata: metadata,
      did: did,
      privateKey: privateKey,
    };

    // Step 2: Sign the credential with ML-DSA-65
    logger.debug(`[store] Signing credential with ML-DSA-65...`);
    const signedCredential = await signer.sign(credentialForSigning, {
      includeProof: true,
      algorithm: process.env.STORAGE_MODE || 'zkp_ready',
    });

    // Step 3: Prepare files for IPFS storage (ALL IN PLAIN)
    const files = [
      {
        path: 'claims.json',
        content: Buffer.from(
          JSON.stringify(signedCredential.claims, null, 2),
          'utf-8'
        ),
      },
      {
        path: 'metadata.json',
        content: Buffer.from(
          JSON.stringify({
            ...signedCredential.metadata,
            ...metadata,
            issuer_did: did,
            stored_at: new Date().toISOString(),
            // NO encryption metadata
            encryption: {
              enabled: false,
              algorithm: 'none',
              note: 'v2: Credentials stored plaintext on IPFS',
            },
          }, null, 2),
          'utf-8'
        ),
      },
      {
        path: 'signature.json',
        content: Buffer.from(
          JSON.stringify({
            id: signedCredential.signature.id,
            algorithm: 'ML-DSA-65',
            issuer_did: signedCredential.signature.issuer_did,
            timestamp: signedCredential.signature.timestamp,
            ml_dsa: signedCredential.signature.ml_dsa,
            claims_hash: signedCredential.signature.claims_hash,
            proof: signedCredential.signature.proof,
            valid_until: signedCredential.signature.valid_until,
          }, null, 2),
          'utf-8'
        ),
      },
    ];

    // Add optional image (plain, not encrypted)
    if (image && Buffer.isBuffer(image)) {
      files.push({
        path: 'image.bin',
        content: image, // NO ENCRYPTION
      });
    }

    // Step 4: Add to IPFS with appropriate options
    const ipfsOptions = {
      cidVersion: 1, // CIDv1 for DHT modern compatibility
      hashAlg: 'blake3', // BLAKE3 for optimal DHT performance in Kubo v0.39
      wrapWithDirectory: true,
      pin: true, // Ensure pinned locally
    };

    logger.debug(`[store] Adding ${files.length} files to IPFS...`);

    let rootCid = null;
    const addedFiles = [];

    for await (const result of ipfs.addAll(files, ipfsOptions)) {
      addedFiles.push({
        path: result.path,
        cid: result.cid.toString(),
      });

      // Last result is the directory root
      if (result.path === '') {
        rootCid = result.cid.toString();
      }
    }

    if (!rootCid) {
      throw new Error(`[store] Failed to determine root CID`);
    }

    logger.info(`✅ [store] Credential stored in IPFS`, {
      credentialId,
      rootCid,
      issuer_did: did,
      files: addedFiles.length,
    });

    // Step 5: Enqueue CID for Provide Sweep
    logger.debug(`[store] Enqueueing CID for Provide Sweep: ${rootCid}`);
    await enqueueCid(rootCid);

    // Step 6: Index credential for pagination
    if (did) {
      await indexCredential(did, rootCid, credentialId);
    }

    // Step 7: Start background replication to other IPFS nodes
    startBackgroundReplication(rootCid);

    // Step 8: Record metrics
    const durationSec = (Date.now() - startTime) / 1000;
    metrics.storeTotal.inc();
    metrics.storeDurationSeconds.observe(durationSec);

    // PQ-specific metrics
    logger.info(`📊 Storage metrics: duration=${durationSec.toFixed(2)}s, cid=${rootCid}`);

    // Prepare response
    const response = {
      success: true,
      credential_id: credentialId,
      cid: rootCid,
      signature_id: signedCredential.signature.id,
      issuer_did: did,
      stored_at: signedCredential.signature.timestamp,

      // Verification info
      claims_hash: signedCredential.signature.claims_hash,
      algorithm: 'ML-DSA-65',
      encryption: 'none', // ✅ NO ENCRYPTION

      // ZKP compatibility
      zkp_compatible: process.env.STORAGE_MODE === 'zkp_ready',
      zkp_commitment: signedCredential.zkp_metadata?.commitment,

      // Duration
      storage_time_ms: Date.now() - startTime,

      // Status
      status: 'stored_with_valid_pq_signature',

      // Raw signature (for verification)
      signature: signedCredential.signature.ml_dsa,

      // Important note
      note: 'Credential stored in PLAIN on IPFS. Signature MUST be verified before use.',
    };

    logger.debug(`[store] Response prepared successfully`);

    // Cleanup
    await signer.close();
    await keyManager.close();

    return response;
  } catch (error) {
    logger.error(`❌ [store] Error storing credential:`, error);
    metrics.storeErrors.inc();
    throw new Error(`Failed to store credential: ${error.message}`);
  }
}

/**
 * Store credential without PQ signature (dev/test only)
 * FOR TESTING ONLY - Do not use in production
 */
export async function storeCredentialPlain(params) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ Plain storage not allowed in production');
  }

  const {
    claims,
    metadata = {},
    credentialId = uuidv4(),
  } = params;

  logger.warn(`⚠️ [store] Storing credential WITHOUT PQ signature (test only)`);

  const ipfs = await getIpfsClient();

  const files = [
    {
      path: 'claims.json',
      content: Buffer.from(JSON.stringify(claims, null, 2)),
    },
    {
      path: 'metadata.json',
      content: Buffer.from(JSON.stringify(metadata, null, 2)),
    },
  ];

  let rootCid = null;
  for await (const result of ipfs.addAll(files, {
    cidVersion: 1,
    wrapWithDirectory: true,
    pin: true,
  })) {
    if (result.path === '') {
      rootCid = result.cid.toString();
    }
  }

  return {
    cid: rootCid,
    credentialId,
    warning: 'No PQ signature - test mode only',
  };
}

export default storeCredential;

