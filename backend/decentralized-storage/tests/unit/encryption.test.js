// tests/unit/encryption.test.js
import { describe, it, expect } from '@jest/globals';
import {
  encrypt,
  decrypt,
  packEncrypted,
  unpackEncrypted,
  encryptCredentialData,
  decryptCredentialData,
  parseMasterKey,
} from '../../src/crypto/encryption.js';
import crypto from 'crypto';

const masterKey = parseMasterKey('a'.repeat(64)); // 32-byte test key
const credentialId = 'test-cred-001';

describe('AES-256-GCM primitives', () => {
  it('encrypt/decrypt round-trip', () => {
    const key       = crypto.randomBytes(32);
    const plaintext = Buffer.from('Hello QSDID!');
    const { ciphertext, iv, tag } = encrypt(plaintext, key);
    const recovered = decrypt(ciphertext, key, iv, tag);
    expect(recovered.toString()).toBe('Hello QSDID!');
  });

  it('tampered tag throws on decrypt', () => {
    const key       = crypto.randomBytes(32);
    const plaintext = Buffer.from('sensitive');
    const { ciphertext, iv, tag } = encrypt(plaintext, key);
    tag[0] ^= 0xff; // corrupt the tag
    expect(() => decrypt(ciphertext, key, iv, tag)).toThrow();
  });
});

describe('Pack/unpack', () => {
  it('round-trip produces same component buffers', () => {
    const salt = crypto.randomBytes(32);
    const iv   = crypto.randomBytes(12);
    const tag  = crypto.randomBytes(16);
    const ct   = crypto.randomBytes(64);
    const packed = packEncrypted(salt, iv, tag, ct);
    const out    = unpackEncrypted(packed);
    expect(out.salt.toString('hex')).toBe(salt.toString('hex'));
    expect(out.iv.toString('hex')).toBe(iv.toString('hex'));
    expect(out.tag.toString('hex')).toBe(tag.toString('hex'));
    expect(out.ciphertext.toString('hex')).toBe(ct.toString('hex'));
  });
});

describe('High-level credential encryption', () => {
  it('encryptCredentialData / decryptCredentialData round-trip', () => {
    const data    = Buffer.from(JSON.stringify({ name: 'Alice', score: 99 }));
    const packed  = encryptCredentialData(data, masterKey, credentialId);
    const decrypted = decryptCredentialData(packed, masterKey, credentialId);
    expect(JSON.parse(decrypted.toString())).toEqual({ name: 'Alice', score: 99 });
  });

  it('wrong credentialId fails decryption', () => {
    const data   = Buffer.from('secret');
    const packed = encryptCredentialData(data, masterKey, credentialId);
    // Different ID → different derived key → auth tag mismatch
    expect(() => decryptCredentialData(packed, masterKey, 'WRONG-ID')).toThrow();
  });
});
