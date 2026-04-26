/**
 * PQ Integration Tests
 * Test post-quantum store/retrieve workflow
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PQCClient } from '../src/pqc/client.js';
import { PQKeyManager } from '../src/pqc/keyManager.js';
import { PQSigner } from '../src/pqc/signer.js';
import { PQVerifier } from '../src/pqc/verifier.js';
import { v4 as uuidv4 } from 'uuid';

describe('PQ Cryptography Integration Tests', () => {
  let keyManager;
  let signer;
  let verifier;

  const testDid = 'did:example:test-issuer-' + uuidv4().substring(0, 8);
  let testKeyPair;

  beforeAll(async () => {
    keyManager = new PQKeyManager();
    signer = new PQSigner();
    verifier = new PQVerifier();

    // Generate test key pair
    testKeyPair = await keyManager.generateKeyPair(testDid, {
      algorithm: 'zkp_ready',
    });
  });

  afterAll(async () => {
    await keyManager.close();
    await signer.close();
    await verifier.close();
  });

  // ============================================
  // Test 1: Signing
  // ============================================

  it('should sign credential with ML-DSA-65', async () => {
    const credential = {
      id: uuidv4(),
      claims: {
        name: 'Test Credential',
        issuer: testDid,
        data: 'sensitive info in plaintext',
      },
      metadata: {
        issued_at: new Date().toISOString(),
      },
      did: testDid,
      privateKey: testKeyPair.ml_dsa_private,
    };

    const signed = await signer.sign(credential, {
      includeProof: true,
      algorithm: 'zkp_ready',
    });

    // Verify structure
    expect(signed).toHaveProperty('signature.ml_dsa');
    expect(signed).toHaveProperty('signature.claims_hash');
    expect(signed).toHaveProperty('signature.proof');
    expect(signed.claims).toEqual(credential.claims); // Claims NOT encrypted
    expect(signed.signature.algorithm).toBe('ML-DSA-65');

    // Store signed credential for later tests
    global.testSignedCredential = signed;
    global.testPrivateKey = credential.privateKey;
  });

  // ============================================
  // Test 2: Verification Success
  // ============================================

  it('should verify valid signature', async () => {
    const credential = global.testSignedCredential;
    const result = await verifier.verify(credential, {
      throwOnFailure: false,
      includeReport: true,
      issuerPublicKey: testKeyPair.ml_dsa_public,
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('VALID');
    expect(result.verified_at).toBeDefined();
    expect(result.duration_ms).toBeGreaterThan(0);
  });

  // ============================================
  // Test 3: Tampered Claims Rejection
  // ============================================

  it('should reject credential with tampered claims', async () => {
    const credential = JSON.parse(
      JSON.stringify(global.testSignedCredential)
    );

    // Tamper with claims
    credential.claims.name = 'MODIFIED';

    const result = await verifier.verify(credential, {
      throwOnFailure: false,
      issuerPublicKey: testKeyPair.ml_dsa_public,
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe('TAMPERED_CLAIMS');
  });

  // ============================================
  // Test 4: Missing Signature Rejection
  // ============================================

  it('should reject credential without signature', async () => {
    const invalidCredential = {
      claims: { test: 'data' },
      metadata: { test: 'metadata' },
      // No signature field
    };

    const result = await verifier.verify(invalidCredential, {
      throwOnFailure: false,
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe('MISSING_SIGNATURE');
  });

  // ============================================
  // Test 5: Invalid Signature Rejection
  // ============================================

  it('should reject credential with invalid signature', async () => {
    const credential = JSON.parse(
      JSON.stringify(global.testSignedCredential)
    );

    // Corrupt the signature
    credential.signature.ml_dsa =
      credential.signature.ml_dsa.substring(0, 100);

    const result = await verifier.verify(credential, {
      throwOnFailure: false,
      issuerPublicKey: testKeyPair.ml_dsa_public,
    });

    expect(result.valid).toBe(false);
  });

  // ============================================
  // Test 6: Key Management
  // ============================================

  it('should retrieve stored public key', async () => {
    const publicKeyData = await keyManager.getPublicKey(testDid);

    expect(publicKeyData.ml_dsa_public).toBe(testKeyPair.ml_dsa_public);
    expect(publicKeyData.ed25519_public).toBe(testKeyPair.ed25519_public);
    expect(publicKeyData.did).toBe(testDid);
  });

  // ============================================
  // Test 7: Key Rotation
  // ============================================

  it('should rotate keys for DID', async () => {
    const oldPublicKey = testKeyPair.ml_dsa_public;

    const newKeyPair = await keyManager.rotateKeys(testDid);

    expect(newKeyPair.ml_dsa_public).not.toBe(oldPublicKey);
    expect(newKeyPair.algorithm).toBe('zkp_ready');
  });

  // ============================================
  // Test 8: ZKP Export Format
  // ============================================

  it('should export credential in ZKP format', async () => {
    const credential = global.testSignedCredential;
    const zkpExport = verifier.exportZKPProof(credential, {
      valid: true,
      verified_at: new Date().toISOString(),
    });

    expect(zkpExport).toHaveProperty('type');
    expect(zkpExport).toHaveProperty('commitment');
    expect(zkpExport.zkp_ready).toBe(true);
    expect(zkpExport.proof_format).toBe('dag-cbor');
  });

  // ============================================
  // Test 9: Batch Verification
  // ============================================

  it('should verify batch of credentials', async () => {
    const credentials = [];

    // Create multiple credentials
    for (let i = 0; i < 3; i++) {
      const cred = {
        id: uuidv4(),
        claims: { index: i, data: 'test-' + i },
        metadata: { created: new Date().toISOString() },
        did: testDid,
        privateKey: testKeyPair.ml_dsa_private,
      };
      const signed = await signer.sign(cred);
      credentials.push(signed);
    }

    // Verify batch
    const batchResult = await verifier.verifyBatch(credentials, {
      throwOnFailure: false,
      issuerPublicKey: testKeyPair.ml_dsa_public,
    });

    expect(batchResult.total).toBe(3);
    expect(batchResult.valid).toBe(3);
    expect(batchResult.invalid).toBe(0);
    expect(batchResult.success_rate).toBe('100.00%');
  });

  // ============================================
  // Test 10: No Encryption Verification
  // ============================================

  it('should store claims in plaintext (no encryption)', async () => {
    const credential = {
      id: uuidv4(),
      claims: {
        secret_data: 'this-is-not-encrypted',
        sensitive: true,
      },
      did: testDid,
      privateKey: testKeyPair.ml_dsa_private,
    };

    const signed = await signer.sign(credential);

    // Verify claims are plaintext (can be read directly)
    expect(signed.claims).toEqual(credential.claims);
    expect(signed.encryption.enabled).toBe(false);
    expect(signed.encryption.algorithm).toBe('none');

    // Try to find the text in the JSON output
    const json = JSON.stringify(signed);
    expect(json).toContain('this-is-not-encrypted');
  });

  // ============================================
  // Test 11: WASM Module Health
  // ============================================

  it('should confirm WASM module is operational', async () => {
    const health = await PQCClient.healthCheck();

    expect(health.status).toBe('up');
    expect(health.module).toBe('qsdid-wasm');
  });

  // ============================================
  // Test 12: Signature Format Validation
  // ============================================

  it('should validate signature format', async () => {
    const credential = global.testSignedCredential;

    // Valid format
    expect(credential.signature.algorithm).toBe('ML-DSA-65');
    expect(typeof credential.signature.ml_dsa).toBe('string');
    expect(credential.signature.ml_dsa.length).toBeGreaterThan(100);

    // ML-DSA-65 signatures are typically ~4000 bytes base64
    const signatureBuffer = Buffer.from(
      credential.signature.ml_dsa,
      'base64'
    );
    expect(signatureBuffer.length).toBeGreaterThan(500);
  });
});

// ============================================
// Edge Case Tests
// ============================================

describe('Edge Cases and Error Handling', () => {
  it('should handle missing DID gracefully', async () => {
    const keyManager = new PQKeyManager();

    try {
      await keyManager.getPublicKey('invalid-did');
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error.message).toContain('not found');
    }

    await keyManager.close();
  });

  it('should timeout on very long verification', async () => {
    const verifier = new PQVerifier();
    const credential = {
      claims: { test: 'data' },
      signature: {
        issuer_did: 'did:example:test',
        ml_dsa: 'x'.repeat(10000),
        claims_hash: 'invalid-hash',
        timestamp: new Date().toISOString(),
      },
    };

    const result = await verifier.verify(credential, {
      throwOnFailure: false,
    });

    expect(result.valid).toBe(false);

    await verifier.close();
  });

  it('should handle concurrent operations', async () => {
    const keyManager = new PQKeyManager();
    const signer = new PQSigner();
    const did = 'did:example:concurrent-' + Date.now();

    try {
      // Generate 5 key pairs concurrently
      const keyPromises = Array.from({ length: 5 }, (_, i) =>
        keyManager.generateKeyPair(did + '-' + i)
      );

      const results = await Promise.all(keyPromises);
      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('ml_dsa_public');
    } finally {
      await keyManager.close();
      await signer.close();
    }
  });
});

// ============================================
// Performance Benchmarks
// ============================================

describe('Performance Benchmarks', () => {
  it('should sign credential in reasonable time', async () => {
    const keyManager = new PQKeyManager();
    const signer = new PQSigner();
    const testDid = 'did:example:perf-test-' + Date.now();

    const keyPair = await keyManager.generateKeyPair(testDid);

    const credential = {
      id: uuidv4(),
      claims: { test: 'performance' },
      did: testDid,
      privateKey: keyPair.ml_dsa_private,
    };

    const startTime = Date.now();
    const signed = await signer.sign(credential);
    const duration = Date.now() - startTime;

    // ML-DSA-65 signing should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
    console.log(`✅ Signing took ${duration}ms`);

    await keyManager.close();
    await signer.close();
  });

  it('should verify credential quickly', async () => {
    const verifier = new PQVerifier();

    // Use pre-generated credential
    const signed = global.testSignedCredential;

    const startTime = Date.now();
    const result = await verifier.verify(signed, {
      throwOnFailure: false,
    });
    const duration = Date.now() - startTime;

    expect(result.valid).toBe(true);
    // Verification should be fast (< 2 seconds)
    expect(duration).toBeLessThan(2000);
    console.log(`✅ Verification took ${duration}ms`);

    await verifier.close();
  });
});
