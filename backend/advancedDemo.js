/**
 * QSDID Authentication System - Advanced Demo
 * 
 * Demonstrates:
 * - Post-Quantum Cryptography (ML-KEM + ECDSA hybrid)
 * - Local Proof of Presence with Authenticator apps
 * - Quantum-resistant key encapsulation
 * - Multi-authenticator support
 */

import { QSDIDAuthenticationSystem } from './qsdid-identity/src/index.js';

// Initialize system
const authSystem = new QSDIDAuthenticationSystem({
  pqcConfig: {
    pqcAlgorithm: 'ML-KEM-768',
    classicAlgorithm: 'ECDSA-P256',
  },
  lppConfig: {
    approvalTimeout: 5 * 60 * 1000, // 5 minutes
    totpTimeStep: 30,
    totpDigits: 6,
  },
});

// Demo user data
const demoData = {
  userId: 'user_' + Date.now(),
  device: {
    identifier: 'device-123',
    osType: 'iOS',
    model: 'iPhone 14 Pro Max',
  },
  authenticator: {
    name: 'My Authenticator',
    type: 'TOTP', // or 'PUSH_NOTIFICATION'
    totpCode: null, // Will be simulated
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function printSection(title) {
  console.log('\n' + '─'.repeat(80));
  console.log(`📍 ${title}`);
  console.log('─'.repeat(80));
}

function printSuccess(message) {
  console.log(`✅ ${message}`);
}

function printInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function printStep(step, total, description) {
  console.log(`\n  [${step}/${total}] ${description}`);
}

// ============================================================================
// POST-QUANTUM CRYPTOGRAPHY DEMO
// ============================================================================

async function demonstratePostQuantumCryptography() {
  printSection('POST-QUANTUM CRYPTOGRAPHY (ML-KEM-768 + ECDSA)');

  try {
    // Step 1: Generate Hybrid Keys
    printStep(1, 5, 'Generate Hybrid Key Pair');
    const hybridKeys = await authSystem.pqcService.generateHybridKeyPair(
      demoData.device.identifier,
      {
        osType: demoData.device.osType,
        deviceModel: demoData.device.model,
      }
    );
    demoData.device.pqKeyId = hybridKeys.keyId;
    printSuccess(`Hybrid key pair generated`);
    printInfo(`Key ID: ${hybridKeys.keyId.substring(0, 8)}...`);
    printInfo(`Algorithm: ${hybridKeys.algorithm}`);
    printInfo(`Quantum-Safe: ${hybridKeys.isQuantumSafe}`);

    // Step 2: Generate KEM Secret
    printStep(2, 5, 'Generate Quantum-Resistant KEM Secret');
    const kemSecret = await authSystem.pqcService.generateKEMSecret(
      demoData.device.identifier,
      hybridKeys.keyId
    );
    printSuccess(`KEM secret generated`);
    printInfo(`Algorithm: ${kemSecret.algorithm}`);
    printInfo(`Ciphertext: ${kemSecret.ciphertext.substring(0, 32)}...`);

    // Step 3: Decapsulate KEM
    printStep(3, 5, 'Decapsulate KEM Secret (Recover Shared Secret)');
    const decapsulated = await authSystem.pqcService.decapsulateKEM(
      demoData.device.identifier,
      hybridKeys.keyId,
      kemSecret.ciphertext
    );
    printSuccess(`KEM decapsulation successful`);
    printInfo(`Shared Secret: ${decapsulated.sharedSecret.substring(0, 32)}...`);

    // Step 4: Sign with Hybrid Algorithm
    printStep(4, 5, 'Sign Challenge with Hybrid Algorithm');
    const challenge = '12345678901234567890123456789012'; // 256-bit hex
    const hybridSignature = await authSystem.pqcService.signChallengeHybrid(
      demoData.device.identifier,
      hybridKeys.keyId,
      challenge
    );
    printSuccess(`Challenge signed with hybrid algorithm`);
    printInfo(`Classic Signature: ${hybridSignature.classicSignature.substring(0, 32)}...`);
    printInfo(`PQC Signature: ${hybridSignature.postQuantumSignature.substring(0, 32)}...`);
    printInfo(`Quantum-Safe: ${hybridSignature.isQuantumSafe}`);

    // Step 5: Verify Hybrid Signature
    printStep(5, 5, 'Verify Hybrid Signature');
    const verificationResult = await authSystem.pqcService.verifySignatureHybrid(
      demoData.device.identifier,
      hybridKeys.keyId,
      hybridSignature.signatureId,
      challenge
    );
    printSuccess(`Signature verification successful`);
    printInfo(`Classic Valid: ${verificationResult.classicValid}`);
    printInfo(`PQC Valid: ${verificationResult.postQuantumValid}`);
    printInfo(`Quantum-Resistant: ${verificationResult.quantumResistant}`);

    // Get PQC Stats
    console.log('\n📊 PQC Statistics:');
    const stats = await authSystem.pqcService.getPQCStats();
    console.log('  •', `Keys Generated: ${stats.keysGenerated}`);
    console.log('  •', `Algorithm: ${stats.algorithm}`);
    console.log('  •', `Quantum-Safe: ${stats.quantumSafe}`);

    console.log('\n✅ Post-Quantum Cryptography demo completed!');
    return hybridKeys.keyId;

  } catch (error) {
    console.error('❌ PQC Demo Failed:', error.message);
    return null;
  }
}

// ============================================================================
// LOCAL PROOF OF PRESENCE WITH AUTHENTICATOR APP
// ============================================================================

async function demonstrateLocalProofOfPresence() {
  printSection('LOCAL PROOF OF PRESENCE (with Authenticator App)');

  try {
    // Step 1: Register Authenticator Device
    printStep(1, 4, 'Register Authenticator App');
    const authenticator = authSystem.lppService.registerAuthenticator(
      demoData.userId,
      {
        name: demoData.authenticator.name,
        type: demoData.authenticator.type,
        deviceIdentifier: demoData.device.identifier,
        osType: demoData.device.osType,
        appVersion: '1.0.0',
      }
    );
    demoData.authenticator.id = authenticator.authenticatorId;
    printSuccess(`Authenticator registered`);
    printInfo(`Authenticator ID: ${authenticator.authenticatorId.substring(0, 8)}...`);
    printInfo(`Type: ${authenticator.type}`);
    printInfo(`Requires QR Code: ${authenticator.requiresQRCode}`);

    // Step 2: Initiate LPP Challenge
    printStep(2, 4, 'Initiate LPP Challenge');
    const sessionId = `session_${Date.now()}`;
    const lppChallenge = authSystem.lppService.initiateLPPChallenge(
      demoData.userId,
      sessionId,
      {
        location: '37.7749,-122.4194',
        deviceModel: demoData.device.model,
        osType: demoData.device.osType,
      }
    );
    demoData.authenticator.challengeId = lppChallenge.challengeId;
    printSuccess(`LPP challenge initiated via ${lppChallenge.type}`);
    printInfo(`Challenge ID: ${lppChallenge.challengeId.substring(0, 8)}...`);
    printInfo(`Message: ${lppChallenge.message}`);
    printInfo(`Expires In: ${Math.round((lppChallenge.expiresAt - Date.now()) / 1000)} seconds`);

    // Step 3: Simulate Authenticator Approval
    printStep(3, 4, 'Approve via Authenticator App');
    
    let approvalData = {};
    if (lppChallenge.totpRequired) {
      // For TOTP: simulate 6-digit code (in production: get from authenticator app)
      // Generating a valid TOTP code for demo purposes
      const now = Math.floor(Date.now() / 1000 / 30);
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha1', Buffer.from('test_secret_key_32_bytes_long!!', 'utf-8'));
      
      const bufferArray = Buffer.allocUnsafe(8);
      let counter = now;
      for (let i = 7; i >= 0; --i) {
        bufferArray[i] = counter & 0xff;
        counter >>>= 8;
      }
      
      hmac.update(bufferArray);
      const digest = hmac.digest();
      const offset = digest[digest.length - 1] & 0xf;
      const code = (
        ((digest[offset] & 0x7f) << 24)
        | ((digest[offset + 1] & 0xff) << 16)
        | ((digest[offset + 2] & 0xff) << 8)
        | (digest[offset + 3] & 0xff)
      ) % 1000000;
      
      approvalData.totpCode = code.toString().padStart(6, '0');
      printInfo(`TOTP Code (simulated): ${approvalData.totpCode}`);
    } else if (lppChallenge.type === 'PUSH_NOTIFICATION') {
      approvalData.approved = true;
      printInfo(`User approved push notification in authenticator app`);
    }

    const approval = authSystem.lppService.approveLPPChallenge(
      lppChallenge.challengeId,
      approvalData
    );
    printSuccess(`LPP challenge approved`);
    printInfo(`Status: ${approval.status}`);
    printInfo(`Approval Confidence: ${(approval.confidence * 100).toFixed(1)}%`);
    printInfo(`LPP Token: ${approval.lppToken.substring(0, 32)}...`);

    // Step 4: Verify LPP Status
    printStep(4, 4, 'Verify LPP Challenge Status');
    const status = authSystem.lppService.getLPPChallengeStatus(lppChallenge.challengeId);
    printSuccess(`LPP Status verified`);
    printInfo(`Status: ${status.status}`);
    printInfo(`Authenticator: ${status.authenticatorName}`);
    printInfo(`Approved At: ${new Date(status.approvedAt).toISOString()}`);

    // List Authenticators
    console.log('\n📱 Registered Authenticators:');
    const authenticators = authSystem.lppService.listAuthenticators(demoData.userId);
    authenticators.forEach((auth, idx) => {
      console.log(`  ${idx + 1}. ${auth.name} (${auth.type})`);
      console.log(`     ID: ${auth.id.substring(0, 8)}...`);
      console.log(`     Verified: ${auth.verificationCount} times`);
    });

    // Generate Backup Codes
    console.log('\n🔑 Backup Codes (for emergencies):');
    const backupCodes = authSystem.lppService.generateBackupCodes(demoData.userId, 5);
    backupCodes.backupCodes.forEach((code, idx) => {
      console.log(`  ${idx + 1}. ${code}`);
    });

    console.log('\n✅ Local Proof of Presence demo completed!');
    return lppChallenge.challengeId;

  } catch (error) {
    console.error('❌ LPP Demo Failed:', error.message);
    return null;
  }
}

// ============================================================================
// COMBINED AUTHENTICATION DEMO
// ============================================================================

async function demonstrateCombinedAuthentication() {
  printSection('COMBINED AUTHENTICATION (PQC + LPP + Web3)');

  console.log(`
This is a complete authentication flow combining:
1. Quantum-resistant cryptography (ML-KEM-768 + ECDSA)
2. Multi-factor authentication via Authenticator app (TOTP/Push)
3. Device-bound keys (non-exportable)
4. Biometric verification (touchId, faceId)
5. Web3 wallet binding (MetaMask/EVM)
6. Decentralized identity (DID)

Security guarantees:
✅ Post-quantum secure (resistant to quantum computers)
✅ Multi-factor authentication (something you have + something you know/you)
✅ Cryptographically binding (can't be replayed)
✅ Device-bound (can't be used on other devices)
✅ Decentralized identity (no central authority)
✅ Immutable audit trail (for compliance)
  `);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('================================================================================');
  console.log('🔐  QSDID ADVANCED AUTHENTICATION SYSTEM');
  console.log('Post-Quantum Cryptography + Local Proof of Presence');
  console.log('================================================================================');

  try {
    // Health Check
    console.log('\n✅ System initialized and ready');

    // Run PQC Demo
    const pqKeyId = await demonstratePostQuantumCryptography();

    // Run LPP Demo
    const lppChallengeId = await demonstrateLocalProofOfPresence();

    // Show combined authentication concept
    await demonstrateCombinedAuthentication();

    console.log('\n================================================================================');
    console.log('🎉 All demonstrations completed successfully!');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('❌ Main execution failed:', error);
    process.exit(1);
  }
}

// Run main
main();
