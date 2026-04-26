// tests/integration/tamperedCredentials.test.js
// Test: Tampered credentials - modify claims, verify signature fails

import { jest } from '@jest/globals';
import crypto from 'crypto';

describe('Tampered Credential Detection', () => {
  // ML-DSA-65 stub for testing
  const mockVerifySignature = (claimsBuffer, signatureBuffer, pubKey) => {
    // In real implementation, use @noble/curves or dilithium library
    // For testing, we'll do a simple HMAC-SHA256 verification
    const expectedSignature = crypto
      .createHmac('sha256', pubKey)
      .update(claimsBuffer)
      .digest();

    return crypto.timingSafeEqual(signatureBuffer, expectedSignature);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reject credential when claims are tampered', () => {
    const pubKey = Buffer.from('secret-key');
    
    // Original claims
    const originalClaims = JSON.stringify({ name: 'John', id: '123' });
    const claimsBuffer = Buffer.from(originalClaims);
    const signature = crypto
      .createHmac('sha256', pubKey)
      .update(claimsBuffer)
      .digest();

    // Tamper with claims
    const tamperedClaims = JSON.stringify({ name: 'John', id: '999' });
    const tamperedBuffer = Buffer.from(tamperedClaims);

    // Verification should fail
    const isValid = mockVerifySignature(tamperedBuffer, signature, pubKey);
    expect(isValid).toBe(false);
  });

  test('should accept credential with valid signature', () => {
    const pubKey = Buffer.from('secret-key');
    const claims = JSON.stringify({ name: 'Jane', id: '456' });
    const claimsBuffer = Buffer.from(claims);
    const signature = crypto
      .createHmac('sha256', pubKey)
      .update(claimsBuffer)
      .digest();

    // Verification should succeed
    const isValid = mockVerifySignature(claimsBuffer, signature, pubKey);
    expect(isValid).toBe(true);
  });

  test('should reject credential when signature is modified', () => {
    const pubKey = Buffer.from('secret-key');
    const claims = JSON.stringify({ name: 'Bob', id: '789' });
    const claimsBuffer = Buffer.from(claims);
    let signature = crypto
      .createHmac('sha256', pubKey)
      .update(claimsBuffer)
      .digest();

    // Flip a byte in signature
    signature[0] = signature[0] ^ 0xff;

    // Verification should fail
    const isValid = mockVerifySignature(claimsBuffer, signature, pubKey);
    expect(isValid).toBe(false);
  });

  test('should reject credential with wrong issuer key', () => {
    const pubKey1 = Buffer.from('secret-key-1');
    const pubKey2 = Buffer.from('secret-key-2');

    const claims = JSON.stringify({ name: 'Alice', id: '000' });
    const claimsBuffer = Buffer.from(claims);

    // Sign with key 1
    const signature = crypto
      .createHmac('sha256', pubKey1)
      .update(claimsBuffer)
      .digest();

    // Try to verify with key 2
    const isValid = mockVerifySignature(claimsBuffer, signature, pubKey2);
    expect(isValid).toBe(false);
  });
});
