// src/crypto/encryption.js
// AES-256-GCM client-side encryption using Node.js built-in crypto.
// Keys are NEVER stored on IPFS.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12;  // 96 bits – recommended for GCM
const TAG_LEN = 16; // 128-bit authentication tag
const SALT_LEN = 32;

/**
 * Derive a 256-bit credential key from the master key using HKDF-SHA256.
 *
 * @param {Buffer} masterKey  – 32-byte master key (from env MASTER_ENCRYPTION_KEY)
 * @param {string} credentialId – unique ID (or DID holder) used as HKDF info
 * @returns {Buffer} 32-byte derived key
 */
export function deriveKey(masterKey, credentialId) {
  const salt = crypto.randomBytes(SALT_LEN);
  return { key: crypto.hkdfSync('sha256', masterKey, salt, credentialId, KEY_LEN), salt };
}

/**
 * Derive a deterministic key for decryption, given the same salt and credentialId.
 */
export function deriveKeyFromSalt(masterKey, salt, credentialId) {
  return crypto.hkdfSync('sha256', masterKey, salt, credentialId, KEY_LEN);
}

/**
 * Encrypt a Buffer using AES-256-GCM.
 *
 * @param {Buffer} plaintext
 * @param {Buffer} key – 32 bytes
 * @returns {{ ciphertext: Buffer, iv: Buffer, tag: Buffer }}
 */
export function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: encrypted, iv, tag };
}

/**
 * Decrypt a Buffer encrypted with AES-256-GCM.
 *
 * @param {Buffer} ciphertext
 * @param {Buffer} key – 32 bytes
 * @param {Buffer} iv
 * @param {Buffer} tag – 16-byte auth tag
 * @returns {Buffer} plaintext
 */
export function decrypt(ciphertext, key, iv, tag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Serialize an encrypted payload to a single Buffer:
 * [salt(32) | iv(12) | ciphertext(N) | tag(16)]
 * This format is self-contained – all params needed for decryption are included.
 * Tag at the end ensures authenticity check covers the entire message.
 */
export function packEncrypted(salt, iv, ciphertext, tag) {
  return Buffer.concat([salt, iv, ciphertext, tag]);
}

/**
 * Deserialize a packed encrypted Buffer back into its components.
 * Extracts: salt → iv → ciphertext → tag(last 16 bytes)
 */
export function unpackEncrypted(packed) {
  if (packed.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error(
      `Invalid packed buffer: minimum ${SALT_LEN + IV_LEN + TAG_LEN} bytes, got ${packed.length}`
    );
  }
  const salt = packed.subarray(0, SALT_LEN);
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = packed.subarray(packed.length - TAG_LEN); // Last 16 bytes
  const ciphertext = packed.subarray(SALT_LEN + IV_LEN, packed.length - TAG_LEN);
  return { salt, iv, tag, ciphertext };
}

/**
 * High-level: encrypt a Buffer with a master key + credential ID.
 * Returns a single self-contained packed Buffer.
 *
 * @param {Buffer} plaintext
 * @param {Buffer} masterKey  – 32 bytes
 * @param {string} credentialId
 * @returns {Buffer}
 */
export function encryptCredentialData(plaintext, masterKey, credentialId) {
  const { key, salt } = deriveKey(masterKey, credentialId);
  const { ciphertext, iv, tag } = encrypt(plaintext, Buffer.from(key));
  return packEncrypted(salt, iv, ciphertext, tag);
}

/**
 * High-level: decrypt a packed Buffer created by encryptCredentialData.
 *
 * @param {Buffer} packed
 * @param {Buffer} masterKey – 32 bytes
 * @param {string} credentialId
 * @returns {Buffer} plaintext
 */
export function decryptCredentialData(packed, masterKey, credentialId) {
  const { salt, iv, tag, ciphertext } = unpackEncrypted(packed);
  const key = deriveKeyFromSalt(masterKey, salt, credentialId);
  return decrypt(ciphertext, Buffer.from(key), iv, tag);
}

/**
 * Parse master key from hex string (env var).
 */
export function parseMasterKey(hexStr) {
  if (hexStr.length !== 64) throw new Error('MASTER_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hexStr, 'hex');
}
