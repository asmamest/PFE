// src/crypto/signature.js
// ML-DSA-65 (FIPS 204 / CRYSTALS-Dilithium level 3) signature verification.
// We use the `dilithium-crystals` npm package which provides a pure-JS
// implementation of Dilithium (ML-DSA). Swap the import for a WASM build
// when performance is critical.

/**
 * Verify an ML-DSA-65 signature.
 *
 * @param {Buffer|Uint8Array} message   – raw bytes that were signed
 * @param {Buffer|Uint8Array} signature – detached signature (.ml-dsa file contents)
 * @param {Buffer|Uint8Array} publicKey – issuer's ML-DSA-65 public key
 * @returns {Promise<boolean>}
 */
export async function verifyMLDSA65(message, signature, publicKey) {
  try {
    // Dynamic import to allow easy swap to WASM build later.
    const { ml_dsa65 } = await import('dilithium-crystals');
    return ml_dsa65.verify(publicKey, message, signature);
  } catch (err) {
    // If the library is unavailable in test environments, log and return false.
    console.warn(`[signature] ML-DSA verify error: ${err.message}`);
    return false;
  }
}

/**
 * Sign a message with an ML-DSA-65 secret key.
 * Used primarily in tests and by the issuer service; not called during retrieval.
 *
 * @param {Buffer|Uint8Array} message
 * @param {Buffer|Uint8Array} secretKey
 * @returns {Promise<Uint8Array>}
 */
export async function signMLDSA65(message, secretKey) {
  const { ml_dsa65 } = await import('dilithium-crystals');
  return ml_dsa65.sign(secretKey, message);
}

/**
 * Generate a fresh ML-DSA-65 keypair.
 * Convenience wrapper for testing / key management utilities.
 *
 * @returns {Promise<{ publicKey: Uint8Array, secretKey: Uint8Array }>}
 */
export async function generateMLDSA65Keypair() {
  const { ml_dsa65 } = await import('dilithium-crystals');
  const seed = new Uint8Array(32);
  // Use Node crypto for secure randomness
  const { webcrypto } = await import('crypto');
  webcrypto.getRandomValues(seed);
  return ml_dsa65.keygen(seed);
}
