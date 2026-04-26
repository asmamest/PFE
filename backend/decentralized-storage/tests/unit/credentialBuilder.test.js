// tests/unit/credentialBuilder.test.js
import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import crypto from 'crypto';

// Mock config before importing builder
jest.mock('../../src/config.js', () => ({
  config: {
    encryption: { masterKeyHex: 'a'.repeat(64) },
    ipfs: { cidVersion: 1, hashAlgo: 'sha2-256' },
  },
}));

const { buildCredentialFiles } = await import('../../src/credential/credentialBuilder.js');

const CRED_ID  = 'cred-unit-test-001';
const claims   = { name: 'Bob', age: 30 };
const metadata = { type: 'TestCredential', issuerDid: 'did:test:issuer' };
const sig      = crypto.randomBytes(64);

describe('buildCredentialFiles', () => {
  let files;

  beforeAll(() => {
    files = buildCredentialFiles({
      credentialId: CRED_ID,
      claims,
      image: null,
      metadata,
      signature: sig,
    });
  });

  it('produces the required file set', () => {
    expect(Object.keys(files)).toContain('claims.json.enc');
    expect(Object.keys(files)).toContain('metadata.json');
    expect(Object.keys(files)).toContain('signature.ml-dsa');
    expect(Object.keys(files)).not.toContain('image.enc');
  });

  it('metadata is valid JSON and contains credentialId', () => {
    const meta = JSON.parse(files['metadata.json'].toString());
    expect(meta.credentialId).toBe(CRED_ID);
    expect(meta.hasImage).toBe(false);
    expect(meta.claimsHash).toBeTruthy();
  });

  it('signature buffer is preserved verbatim', () => {
    expect(files['signature.ml-dsa'].toString('hex')).toBe(sig.toString('hex'));
  });

  it('includes image.enc when image is provided', () => {
    const withImage = buildCredentialFiles({
      credentialId: 'img-cred',
      claims,
      image: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      metadata,
      signature: sig,
    });
    expect(Object.keys(withImage)).toContain('image.enc');
    const meta = JSON.parse(withImage['metadata.json'].toString());
    expect(meta.hasImage).toBe(true);
  });
});
