// src/credential/credentialBuilder.js
// Assembles the four files that make up a QSDID credential directory,
// encrypts sensitive content, and returns them as Buffers ready for IPFS add.

import crypto from 'crypto';
import { encryptCredentialData, parseMasterKey } from '../crypto/encryption.js';
import { config } from '../config.js';

const masterKey = parseMasterKey(config.encryption.masterKeyHex);

/**
 * Build all credential files from raw input.
 *
 * @param {object} params
 * @param {string}  params.credentialId  – UUID v4 (caller must supply)
 * @param {object}  params.claims        – plain-object claims (will be JSON-serialised & encrypted)
 * @param {Buffer|null} params.image     – raw image bytes (null if no image)
 * @param {object}  params.metadata      – non-sensitive metadata (stored plaintext)
 * @param {Buffer}  params.signature     – ML-DSA-65 detached signature bytes
 *
 * @returns {{
 *   'claims.json.enc': Buffer,
 *   'image.enc'?: Buffer,
 *   'signature.ml-dsa': Buffer,
 *   'metadata.json': Buffer,
 * }}
 */
export function buildCredentialFiles({
  credentialId,
  claims,
  image = null,
  metadata,
  signature,
}) {
  // ── Encrypt claims ─────────────────────────────────────────
  const claimsPlain = Buffer.from(JSON.stringify(claims));
  const claimsEnc   = encryptCredentialData(claimsPlain, masterKey, `claims:${credentialId}`);

  // ── Encrypt image (streaming-safe: process in 1 MiB chunks) ──
  let imageEnc = null;
  if (image) {
    // For images > 1 MiB we still encrypt as a single blob here;
    // the encryption itself is O(N) in memory. For very large files,
    // a streaming cipher (Transform stream) should replace this.
    imageEnc = encryptCredentialData(image, masterKey, `image:${credentialId}`);
  }

  // ── Build metadata.json ───────────────────────────────────
  // metadata is stored plaintext so verifiers can look up type/issuer
  // without decrypting the claims.
  const fullMetadata = {
    ...metadata,
    credentialId,
    createdAt: new Date().toISOString(),
    // Content hash of the raw claims (before encryption) for integrity check
    claimsHash: crypto.createHash('sha256').update(claimsPlain).digest('hex'),
    hasImage: image !== null,
    cidVersion: config.ipfs.cidVersion,
    hashAlgo: config.ipfs.hashAlgo,
  };

  const files = {
    'claims.json.enc':   claimsEnc,
    'signature.ml-dsa':  Buffer.isBuffer(signature) ? signature : Buffer.from(signature),
    'metadata.json':     Buffer.from(JSON.stringify(fullMetadata, null, 2)),
  };

  if (imageEnc) {
    files['image.enc'] = imageEnc;
  }

  return files;
}
