#!/usr/bin/env node
// examples/retrieve-credential.js
// Example: retrieve and verify a credential via the REST API.
// Usage: node examples/retrieve-credential.js <rootCID> [issuerPubKeyHex]

import { Buffer } from 'node:buffer';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3500/api/v1';

const rootCid = process.argv[2];
if (!rootCid) {
  console.error('Usage: node retrieve-credential.js <rootCID> [issuerPubKeyHex]');
  process.exit(1);
}

// In production, load the issuer's real ML-DSA-65 public key (hex).
// Here we use a placeholder of the correct length (1952 bytes for ML-DSA-65).
const issuerPubKey = process.argv[3] ?? '00'.repeat(1952);

const url = `${API_BASE}/retrieve/${rootCid}?issuerPubKey=${issuerPubKey}`;
console.log(`Retrieving rootCID=${rootCid} ...`);

try {
  const response = await fetch(url);
  const result = await response.json();

  if (!response.ok) {
    console.error('Retrieve failed:', result);
    process.exit(1);
  }

  console.log('✔  Credential retrieved!');
  console.log(`   credentialId   : ${result.metadata?.credentialId}`);
  console.log(`   type           : ${result.metadata?.type}`);
  console.log(`   signatureValid : ${result.signatureValid} (Note: would be false if pubKey doesn't match)`);
  console.log('');
  console.log('Claims:');
  console.log(JSON.stringify(result.claims, null, 2));

  if (result.image) {
    console.log(`\nImage: ${result.image.length} base64 chars`);
  }
} catch (err) {
  console.error('Network or Parse error:', err.message);
  process.exit(1);
}
