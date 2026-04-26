// tests/integration/storeRetrieve.test.js
// Requires a running Kubo v0.39 node (Docker recommended) and Redis.
// Set env vars IPFS_API_URL and REDIS_URL before running.
//
// Run: IPFS_API_URL=http://localhost:5001 REDIS_URL=redis://localhost:6379 \
//        node --experimental-vm-modules node_modules/.bin/jest tests/integration

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { storeCredential } from '../../src/credential/store.js';
import { retrieveCredential } from '../../src/credential/retrieve.js';
import { generateMLDSA65Keypair, signMLDSA65 } from '../../src/crypto/signature.js';
import { closeRedis } from '../../src/provider/cidQueue.js';
import { parseMasterKey } from '../../src/crypto/encryption.js';

// Skip gracefully if IPFS is not available
const IPFS_URL = process.env.IPFS_API_URL ?? 'http://localhost:5001';
const skipIfNoIpfs = async () => {
  try {
    const res = await fetch(`${IPFS_URL}/api/v0/id`, { method: 'POST', signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('not ok');
  } catch {
    return true; // skip
  }
  return false;
};

describe('Store → Retrieve integration', () => {
  let shouldSkip = false;
  let keypair, rootCid, credentialId;

  beforeAll(async () => {
    shouldSkip = await skipIfNoIpfs();
    if (shouldSkip) return;
    keypair = await generateMLDSA65Keypair();
    credentialId = uuidv4();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it('stores a credential and returns a CIDv1', async () => {
    if (shouldSkip) return console.warn('SKIP: IPFS not reachable');

    const claims   = { name: 'Alice', role: 'Engineer' };
    const metadata = {
      type: 'TestCredential',
      issuerDid: 'did:test:gov',
      holderDid: 'did:test:alice',
    };
    const claimsRaw = Buffer.from(JSON.stringify(claims));
    const signature = await signMLDSA65(claimsRaw, keypair.secretKey);

    const result = await storeCredential({
      credentialId,
      claims,
      image: null,
      metadata,
      signature: Buffer.from(signature),
    });

    expect(result.rootCid).toBeTruthy();
    expect(result.rootCid).toMatch(/^bafy/); // CIDv1 base32 prefix
    rootCid = result.rootCid;
  });

  it('retrieves the credential and verifies the ML-DSA-65 signature', async () => {
    if (shouldSkip || !rootCid) return console.warn('SKIP: store step not run');

    const result = await retrieveCredential(rootCid, Buffer.from(keypair.publicKey));

    expect(result.claims.name).toBe('Alice');
    expect(result.signatureValid).toBe(true);
    expect(result.metadata.credentialId).toBe(credentialId);
  });

  it('fails signature verification with the wrong public key', async () => {
    if (shouldSkip || !rootCid) return console.warn('SKIP');

    const wrongKey = crypto.randomBytes(1952); // wrong ML-DSA-65 pub key length
    const result   = await retrieveCredential(rootCid, wrongKey);
    expect(result.signatureValid).toBe(false);
  });
});
