/**
 * QSDID Storage v2.0 - Complete Usage Example
 * 
 * This example shows the complete workflow:
 * 1. Generate hybrid PQ keys
 * 2. Store credential with ML-DSA-65 signature (plaintext)
 * 3. Retrieve credential with mandatory verification
 * 4. Export for ZKP blockchain integration
 */

import fetch from 'node-fetch';

// ============================================
// Configuration
// ============================================

const STORAGE_API = 'http://localhost:3000/api/v1';

// Example DIDs (unique identifiers for participants)
const ISSUER_DID = 'did:example:issuer123';
const HOLDER_DID = 'did:example:holder456';

// Example keys (in production, these come from PQKeyManager)
const ISSUER_PRIVATE_KEY = 'ML-DSA-65-private-key-base64-encoded-here';
const ISSUER_PUBLIC_KEY = 'ML-DSA-65-public-key-base64-encoded-here';

// ============================================
// Step 1: Store a Credential with PQ Signature
// ============================================

async function exampleStoreCredential() {
  console.log('\n=== STEP 1: Store Credential with ML-DSA-65 Signature ===\n');

  // Define credential claims (stored in PLAIN on IPFS, no encryption)
  const claims = {
    // Credential metadata
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'University Degree'],
    issuer: ISSUER_DID,
    subject: {
      id: HOLDER_DID,
      name: 'Alice Smith',
      email: 'alice@example.com',
    },

    // Actual claims (PLAINTEXT)
    credentialSubject: {
      degree: {
        name: 'Bachelor of Science in Computer Science',
        university: 'MIT',
      },
    },

    // Timestamps
    issuanceDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const metadata = {
    issuer_name: 'MIT',
    credential_type: 'degree',
    subject_did: HOLDER_DID,
    issued_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${STORAGE_API}/store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claims: claims,
        metadata: metadata,
        did: ISSUER_DID,
        privateKey: ISSUER_PRIVATE_KEY,
        // Optional: image as base64
        // image: Buffer.from(imageBuffer).toString('base64'),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const stored = await response.json();

    console.log('✅ Credential stored successfully!\n');
    console.log('Response:', JSON.stringify(stored, null, 2));

    return stored.cid; // Return CID for retrieval
  } catch (error) {
    console.error('❌ Error storing credential:', error.message);
    throw error;
  }
}

// ============================================
// Step 2: Retrieve Credential with Verification
// ============================================

async function exampleRetrieveCredential(rootCid) {
  console.log('\n=== STEP 2: Retrieve Credential (MANDATORY PQ Verification) ===\n');

  try {
    const response = await fetch(
      `${STORAGE_API}/retrieve/${rootCid}?include_proof=true`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `HTTP ${response.status}: ${error.error || response.statusText}`
      );
    }

    const retrieved = await response.json();

    console.log('✅ Credential retrieved and verified!\n');
    console.log('Verification Status:', retrieved.verification);
    console.log('\nCredential Claims:');
    console.log(JSON.stringify(retrieved.credential.claims, null, 2));
    console.log('\nCredential Metadata:');
    console.log(JSON.stringify(retrieved.credential.metadata, null, 2));

    if (retrieved.verification_report) {
      console.log('\nVerification Report:');
      console.log(JSON.stringify(retrieved.verification_report, null, 2));
    }

    return retrieved;
  } catch (error) {
    console.error('❌ Error retrieving credential:', error.message);
    throw error;
  }
}

// ============================================
// Step 3: Verify Signature Only
// ============================================

async function exampleVerifySignature(rootCid) {
  console.log('\n=== STEP 3: Verify Signature Only (No Claims Returned) ===\n');

  try {
    const response = await fetch(`${STORAGE_API}/verify/${rootCid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const verification = await response.json();

    console.log('✅ Signature verification result:\n');
    console.log(JSON.stringify(verification, null, 2));

    return verification;
  } catch (error) {
    console.error('❌ Error verifying signature:', error.message);
    throw error;
  }
}

// ============================================
// Step 4: Export for ZKP (Blockchain Integration)
// ============================================

async function exampleExportForZKP(rootCid) {
  console.log('\n=== STEP 4: Export for ZKP (Blockchain Ready) ===\n');

  try {
    const response = await fetch(`${STORAGE_API}/export-zkp/${rootCid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const zkpExport = await response.json();

    console.log('✅ ZKP export successful!\n');
    console.log('ZKP-Compatible Format:');
    console.log(JSON.stringify(zkpExport.zkp_export, null, 2));

    return zkpExport;
  } catch (error) {
    console.error('❌ Error exporting for ZKP:', error.message);
    throw error;
  }
}

// ============================================
// Step 5: List Credentials (Pagination)
// ============================================

async function exampleListCredentials(holderDid, page = 1, limit = 10) {
  console.log(
    `\n=== STEP 5: List Credentials for ${holderDid} ===\n`
  );

  try {
    const response = await fetch(
      `${STORAGE_API}/credentials?did=${holderDid}&page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const list = await response.json();

    console.log(`✅ Found ${list.pagination.total} total credentials\n`);
    console.log('Pagination:', list.pagination);
    console.log(
      `\nCredentials (showing ${list.credentials.length}):`,
      list.credentials.map((c) => ({ cid: c.cid, stored_at: c.stored_at }))
    );

    return list;
  } catch (error) {
    console.error('❌ Error listing credentials:', error.message);
    throw error;
  }
}

// ============================================
// Step 6: Batch Retrieve Multiple Credentials
// ============================================

async function exampleBatchRetrieve(cids) {
  console.log(
    `\n=== STEP 6: Batch Retrieve ${cids.length} Credentials ===\n`
  );

  try {
    const response = await fetch(`${STORAGE_API}/retrieve-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cids }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const batch = await response.json();

    console.log('✅ Batch retrieval complete!\n');
    console.log('Summary:', batch.summary);
    console.log(
      `\nResults: ${batch.results.filter((r) => r.success).length} successful, ${batch.results.filter((r) => !r.success).length} failed`
    );

    return batch;
  } catch (error) {
    console.error('❌ Error in batch retrieval:', error.message);
    throw error;
  }
}

// ============================================
// Security Features Example
// ============================================

async function exampleSecurityFeatures() {
  console.log('\n=== Security Features ===\n');

  console.log('✅ No Encryption');
  console.log('   - Credentials stored PLAIN on IPFS');
  console.log('   - No AES-256-GCM or other encryption');
  console.log('   - Faster than encrypted alternatives\n');

  console.log('✅ ML-DSA-65 Signatures (Post-Quantum)');
  console.log('   - MANDATORY on every credential');
  console.log('   - FIPS 204 post-quantum standard');
  console.log('   - Verified before any data access\n');

  console.log('✅ Tamper Detection');
  console.log('   - BLAKE3 hash of claims');
  console.log('   - Cryptographic signature verification');
  console.log('   - Claims modified → automatic rejection\n');

  console.log('✅ ZKP Ready');
  console.log('   - Compatible with blockchain circuits');
  console.log('   - Zero Knowledge Proofs support');
  console.log('   - Distributed verification\n');

  console.log('✅ DID Validation');
  console.log('   - issuer DID required');
  console.log('   - holder DID tracked');
  console.log('   - Identity correlation built-in\n');
}

// ============================================
// Main: Full Workflow
// ============================================

async function fullWorkflow() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   QSDID Storage v2.0 - Complete Usage Example          ║');
  console.log('║   (Post-Quantum ML-DSA-65, Plaintext Storage, ZKP)     ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // 1. Store credential
    const cid = await exampleStoreCredential();

    // 2. Retrieve with verification
    const retrieved = await exampleRetrieveCredential(cid);

    // 3. Verify signature
    await exampleVerifySignature(cid);

    // 4. Export for ZKP
    await exampleExportForZKP(cid);

    // 5. List credentials
    await exampleListCredentials(HOLDER_DID);

    // 6. Batch operations
    // await exampleBatchRetrieve([cid]);

    // Security overview
    exampleSecurityFeatures();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   ✅ All operations completed successfully!            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error(
      '\n❌ Workflow failed:',
      error.message
    );
    process.exit(1);
  }
}

// ============================================
// Run Examples
// ============================================

if (import.meta.url === `file://${process.argv[1]}`) {
  fullWorkflow().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export {
  exampleStoreCredential,
  exampleRetrieveCredential,
  exampleVerifySignature,
  exampleExportForZKP,
  exampleListCredentials,
  exampleBatchRetrieve,
  exampleSecurityFeatures,
  fullWorkflow,
};
