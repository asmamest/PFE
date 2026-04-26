#!/usr/bin/env node
// examples/store-credential.js
// Example: store a full QSDID credential via the REST API.
// Using native fetch and FormData (Node 18+).

import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3500/api/v1';

// ── Mock data ─────────────────────────────────────────────────
const credentialId = uuidv4();

const claims = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: 'VerifiableCredential',
  holder: 'did:qsdid:holder123',
  givenName: 'Alice',
  familyName: 'Dupont',
  dateOfBirth: '1990-01-01',
  nationalId: 'FR-123456789',
};

const metadata = {
  credentialId,
  type: 'NationalIDCredential',
  issuerDid: 'did:qsdid:issuer:gov-fr',
  holderDid: 'did:qsdid:holder123',
  issuanceDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  fraudScore: 0.02,
  schema: 'https://schema.qsdid.io/credentials/v1/national-id',
};

const mockSignature = crypto.randomBytes(64);
const mockImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ── Build native FormData ─────────────────────────────────────
const form = new FormData();
form.append('claims', JSON.stringify(claims));
form.append('metadata', JSON.stringify(metadata));

// Wrap buffers in Blobs for native FormData
form.append('signature', new Blob([mockSignature]), 'signature.ml-dsa');
form.append('image', new Blob([mockImage]), 'image.enc');

// ── Call API ──────────────────────────────────────────────────
console.log(`Storing credential ${credentialId} ...`);
try {
  const response = await fetch(`${API_BASE}/store`, {
    method: 'POST',
    body: form,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('Store failed:', result);
    process.exit(1);
  }

  console.log('✔  Credential stored!');
  console.log(`   credentialId : ${result.credentialId}`);
  console.log(`   rootCID      : ${result.rootCid}`);
  console.log('');
  console.log('To retrieve:');
  console.log(`  node examples/retrieve-credential.js ${result.rootCid}`);
} catch (err) {
  console.error('Network or Parse error:', err.message);
  process.exit(1);
}
