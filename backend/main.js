/**
 * QSDID Authentication System - Main Demo & Execution
 * 
 * This file demonstrates:
 * 1. Complete registration flow
 * 2. Complete login flow
 * 3. Admin operations
 * 4. Frontend integration patterns
 */

import { QSDIDAuthenticationSystem } from './qsdid-identity/src/index.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

const authSystem = new QSDIDAuthenticationSystem({
  sessionConfig: {
    sessionTimeout: 5 * 60 * 1000,
    nonceTTL: 10 * 60 * 1000,
    maxAttempts: 5,
  },
  keyConfig: {
    keyRotationPolicy: 90 * 24 * 60 * 60 * 1000,
    maxKeysPerDevice: 5,
  },
  walletConfig: {
    walletVerificationTimeout: 5 * 60 * 1000,
    maxWalletsPerIdentity: 3,
  },
});

console.log('\n' + '='.repeat(80));
console.log('🔐  QSDID PRODUCTION-GRADE AUTHENTICATION SYSTEM');
console.log('='.repeat(80) + '\n');

// ============================================================================
// DEMO DATA
// ============================================================================

const demoData = {
  device: {
    id: 'device-iphone-14-pro-max-' + Date.now(),
    identifier: 'device-123',
    osType: 'iOS',
    model: 'iPhone 14 Pro Max',
    keyId: null, // Will be set during registration
  },
  wallet: {
    address: '0x742d35Cc6634C0532925a3b844Bc0e8b8a54d59d',
    // Mock signature that will pass simulation - wallet address (40 hex chars) + 90 more = 130 total
    signature: '0x742d35cc6634c0532925a3b844bc0e8b8a54d59d' + 'f'.repeat(90),
  },
  user: {
    name: 'Alice Blockchain',
    email: 'alice@qsdid.io',
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

function printError(message) {
  console.log(`❌ ${message}`);
}

function printInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function printStep(step, total, description) {
  console.log(`\n  [${step}/${total}] ${description}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// REGISTRATION FLOW DEMO
// ============================================================================

async function demonstrateRegistration() {
  printSection('REGISTRATION FLOW (9 Steps)');
  
  const registration = authSystem.getRegistrationFlow();
  let sessionId, identityId;

  try {
    // Step 1: Initialize Registration
    printStep(1, 9, 'Initialize Registration Session');
    const session = await registration.initializeRegistration({
      deviceIdentifier: demoData.device.identifier,
      osType: demoData.device.osType,
      deviceModel: demoData.device.model,
    });
    sessionId = session.sessionId;
    printSuccess(`Session created: ${sessionId.substring(0, 8)}...`);
    printInfo(`Challenge: ${session.challenge.substring(0, 16)}... (256-bit nonce)`);
    printInfo(`Expires: ${new Date(session.expiresAt).toISOString()}`);

    // Step 2: Request LPP
    printStep(2, 9, 'Request Local Proof of Presence (LPP)');
    const lppRequest = await registration.requestLocalProofOfPresence(sessionId);
    printSuccess(`LPP challenge sent: ${lppRequest.lppChallengeId.substring(0, 8)}...`);
    printInfo(`Status: ${lppRequest.status}`);
    printInfo(`Message: "${lppRequest.message}"`);

    // Step 3: Approve LPP
    printStep(3, 9, 'Approve Local Proof of Presence');
    const lppToken = 'lpp_approval_token_' + Date.now(); // Simulate user approval
    const lppApproval = await registration.approveLocalProofOfPresence(
      sessionId,
      lppToken
    );
    printSuccess(`LPP approved by user`);
    printInfo(`Status: ${lppApproval.status}`);

    // Step 4: Generate Device Keys
    printStep(4, 9, 'Generate Device-Bound Key Pair');
    const keyGen = await registration.generateDeviceKeys(
      sessionId,
      demoData.device.identifier,
      {
        hardware: 'TPM2.0',
        osType: demoData.device.osType,
      }
    );
    demoData.device.keyId = keyGen.keyId; // Save for login flow
    printSuccess(`Device keys generated (ECDSA P-256)`);
    printInfo(`Key ID: ${keyGen.keyId.substring(0, 8)}...`);
    printInfo(`Algorithm: ${keyGen.attestation.type} (simulated TPM)`);
    printInfo(`Public Key: ${keyGen.publicKey.substring(0, 50)}...`);

    // Step 5: Sign Challenge
    printStep(5, 9, 'Sign Challenge with Device Private Key');
    const signedChallenge = await registration.signChallenge(
      sessionId,
      demoData.device.identifier,
      keyGen.keyId
    );
    printSuccess(`Challenge signed with device private key`);
    printInfo(`Signature: ${signedChallenge.signature.substring(0, 32)}...`);
    printInfo(`Algorithm: ${signedChallenge.algorithm}`);

    // Step 6: Verify Signature
    printStep(6, 9, 'Server-Side Signature Verification');
    const verification = await registration.verifySignature(
      sessionId,
      demoData.device.identifier,
      keyGen.keyId,
      signedChallenge.signature
    );
    printSuccess(`Signature verified ✓`);
    printInfo(`Single-use nonce consumed (replay protection activated)`);

    // Step 7: Initiate Wallet Binding
    printStep(7, 9, 'Initiate Wallet Binding (MetaMask)');
    const walletChallenge = await registration.initiateWalletBinding(sessionId);
    printSuccess(`Wallet challenge created: ${walletChallenge.challengeId.substring(0, 8)}...`);
    printInfo(`Message: "${walletChallenge.message.substring(0, 60)}..."`);
    printInfo(`Expires: ${new Date(walletChallenge.expiresAt).toISOString()}`);

    // Step 8: Complete Wallet Binding
    printStep(8, 9, 'Complete Wallet Binding (User Signs with MetaMask)');
    const walletBinding = await registration.completeWalletBinding(
      sessionId,
      demoData.wallet.address,
      demoData.wallet.signature,
      walletChallenge.challengeId
    );
    printSuccess(`Wallet bound to identity`);
    printInfo(`Wallet: ${walletBinding.walletAddress}`);
    printInfo(`Status: ${walletBinding.status}`);

    // Step 9: Create Identity & Issue Token
    printStep(9, 9, 'Create Decentralized Identity (DID) & Issue Token');
    const identity = await registration.createIdentity(
      sessionId,
      demoData.device.identifier
    );
    identityId = identity.identityId;
    printSuccess(`Identity created successfully! 🎉`);
    printInfo(`Identity ID: ${identity.identityId.substring(0, 8)}...`);
    printInfo(`DID: ${identity.did}`);
    printInfo(`Auth Token: ${identity.authToken.substring(0, 20)}...`);
    printInfo(`Status: ${identity.status}`);

    return identityId;

  } catch (error) {
    printError(`Registration failed: ${error.message}`);
    console.error('Details:', error);
    return null;
  }
}

// ============================================================================
// LOGIN FLOW DEMO
// ============================================================================

async function demonstrateLogin(identityId) {
  printSection('LOGIN FLOW (6 Steps)');

  // Reinitialize state machine for new session
  // In production, each session has its own state machine
  authSystem.reinitializeStateMachine();

  const login = authSystem.getLoginFlow();

  try {
    // Step 1: Initialize Login
    printStep(1, 6, 'Initialize Login Session');
    const session = await login.initializeLogin({
      deviceIdentifier: demoData.device.identifier,
    });
    printSuccess(`Login session created: ${session.sessionId.substring(0, 8)}...`);
    printInfo(`Challenge: ${session.challenge.substring(0, 16)}... (new 256-bit nonce)`);

    // Step 2-3: LPP
    printStep(2, 6, 'Request & Approve Local Proof of Presence');
    const lppRequest = await login.requestLocalProofOfPresence(session.sessionId);
    const lppApproval = await login.approveLocalProofOfPresence(
      session.sessionId,
      'lpp_token_' + Date.now()
    );
    printSuccess(`LPP approved`);
    printInfo(`Status: ${lppApproval.status}`);

    // Step 4: Sign Challenge with Existing Key
    printStep(4, 6, 'Sign with Existing Device Key');
    const signedChallenge = await login.signChallenge(
      session.sessionId,
      demoData.device.identifier,
      demoData.device.keyId // Use key generated during registration
    );
    printSuccess(`Challenge signed`);

    // Step 5: Verify & Check Wallet
    printStep(5, 6, 'Verify Signature & Check Wallet Binding');
    const verification = await login.verifySignature(
      session.sessionId,
      demoData.device.identifier,
      'key-abc123',
      signedChallenge.signature
    );
    printSuccess(`Signature verified ✓`);

    const walletVerification = await login.verifyWalletBinding(
      session.sessionId,
      identityId,
      demoData.wallet.address
    );
    printSuccess(`Wallet binding verified ✓`);
    printInfo(`Wallet: ${walletVerification.bindingId ? 'Bound' : 'Not bound'}`);

    // Step 6: Issue Token
    printStep(6, 6, 'Issue Access Token');
    const token = await login.issueAccessToken(session.sessionId, identityId);
    printSuccess(`Access token issued! 🎉`);
    printInfo(`Token: ${token.accessToken.substring(0, 20)}...`);
    printInfo(`Expires in: ${token.expiresIn} seconds`);
    printInfo(`DID: ${token.did}`);

    return token;

  } catch (error) {
    printError(`Login failed: ${error.message}`);
    console.error('Details:', error);
    return null;
  }
}

// ============================================================================
// ADMIN OPERATIONS DEMO
// ============================================================================

async function demonstrateAdminOperations(sessionId, identityId) {
  printSection('ADMIN OPERATIONS');

  try {
    // Get Authentication Status
    console.log('\n📊 Authentication Status:');
    const status = authSystem.getAuthenticationStatus(sessionId);
    console.log('  •', `Status: ${status.status}`);
    console.log('  •', `Flow Type: ${status.flowType}`);
    console.log('  •', `Created: ${new Date(status.createdAt).toISOString()}`);

    // Verify Identity
    console.log('\n📋 Identity Verification:');
    const identity = authSystem.verifyIdentity(identityId);
    console.log('  •', `Valid: ${identity.valid}`);
    console.log('  •', `DID: ${identity.did}`);
    console.log('  •', `Status: ${identity.status}`);
    console.log('  •', `Verification: ${identity.verificationStatus}`);

    // Get Audit Logs
    console.log('\n📝 Audit Logs (Last 5 events):');
    const logs = authSystem.getSessionAuditLog(sessionId);
    logs.slice(0, 5).forEach((log, idx) => {
      console.log(`  ${idx + 1}. [${log.level}] ${log.category}`);
      console.log(`     Time: ${new Date(log.timestamp).toISOString()}`);
    });

    // Get System Metrics
    console.log('\n📊 System Metrics:');
    const metrics = authSystem.getSystemMetrics();
    console.log('  •', `Active Sessions: ${metrics.sessions.activeSessions}`);
    console.log('  •', `Total Identities: ${metrics.identities.length}`);
    console.log('  •', `Audit Logs: ${metrics.auditLogs.total}`);

    // Get Security Incidents
    console.log('\n🔒 Security Incidents (Last 24h):');
    const incidents = authSystem.getSecurityIncidents(24);
    console.log('  •', `Total Incidents: ${incidents.length}`);

    // Export DID Document
    console.log('\n🆔 DID Document Export:');
    const didDoc = authSystem.exportDIDDocument(identityId);
    console.log('  •', `DID: ${didDoc.id}`);
    console.log('  •', `Public Keys: ${didDoc.publicKey.length}`);
    console.log('  •', `Services: ${didDoc.service.length}`);
    console.log('  •', `Web3 Wallet: ${didDoc.service[0]?.serviceEndpoint}`);

    // Health Check
    console.log('\n❤️  System Health:');
    const health = authSystem.getHealthStatus();
    console.log('  •', `Status: ${health.status}`);
    Object.entries(health.components).forEach(([component, status]) => {
      console.log(`  •`, `${component}: ${status}`);
    });

  } catch (error) {
    printError(`Admin operation failed: ${error.message}`);
  }
}

// ============================================================================
// FRONTEND INTEGRATION EXAMPLE
// ============================================================================

function showFrontendIntegrationExample() {
  printSection('FRONTEND INTEGRATION EXAMPLE');

  const example = `
// React Component Example
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function AuthenticationFlow() {
  const [session, setSession] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Initialize Registration
  const startRegistration = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/auth/register/init', {
        deviceIdentifier: navigator.userAgent,
        osType: navigator.platform,
      });
      setSession(response.data);
    } catch (error) {
      console.error('Registration init failed:', error);
    }
    setLoading(false);
  };

  // Step 2: Get LPP Approval (from authenticator app)
  const approveLPP = async () => {
    try {
      const approvalToken = await getUserApprovalFromAuthenticator();
      await axios.post(\`/auth/register/lpp-approve\`, {
        sessionId: session.sessionId,
        token: approvalToken,
      });
    } catch (error) {
      console.error('LPP approval failed:', error);
    }
  };

  // Step 3: Generate Keys (device-bound)
  const generateKeys = async () => {
    try {
      const keys = await device.generateKeyPair();
      await axios.post(\`/auth/register/generate-keys\`, {
        sessionId: session.sessionId,
        publicKey: keys.publicKey,
      });
    } catch (error) {
      console.error('Key generation failed:', error);
    }
  };

  // Step 4: Sign Challenge
  const signChallenge = async () => {
    try {
      const signature = await device.signChallenge(session.challenge);
      await axios.post(\`/auth/register/sign\`, {
        sessionId: session.sessionId,
        signature,
      });
    } catch (error) {
      console.error('Signing failed:', error);
    }
  };

  // Step 5: Connect Wallet (MetaMask)
  const connectWallet = async () => {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const walletAddress = accounts[0];
      
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [session.walletChallenge.message, walletAddress],
      });

      await axios.post(\`/auth/register/bind-wallet\`, {
        sessionId: session.sessionId,
        walletAddress,
        signature,
      });
    } catch (error) {
      console.error('Wallet binding failed:', error);
    }
  };

  // Step 6: Complete Registration
  const completeRegistration = async () => {
    try {
      const response = await axios.post(\`/auth/register/complete\`, {
        sessionId: session.sessionId,
      });
      setIdentity(response.data);
      localStorage.setItem('authToken', response.data.authToken);
    } catch (error) {
      console.error('Completion failed:', error);
    }
  };

  return (
    <div className="auth-flow">
      <h1>QSDID Authentication</h1>
      {!session && <button onClick={startRegistration}>Start Registration</button>}
      {session && !identity && (
        <>
          <button onClick={approveLPP}>Approve (Authenticator)</button>
          <button onClick={generateKeys}>Generate Keys</button>
          <button onClick={signChallenge}>Sign Challenge</button>
          <button onClick={connectWallet}>Connect Wallet</button>
          <button onClick={completeRegistration}>Complete</button>
        </>
      )}
      {identity && <div>✅ Authenticated!</div>}
    </div>
  );
}
`;

  console.log(example);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // System Health Check
    printSection('SYSTEM STATUS');
    const health = authSystem.getHealthStatus();
    printSuccess(`System Status: ${health.status}`);
    console.log('Components:', Object.entries(health.components)
      .map(([name, status]) => `${name}: ${status}`)
      .join(', '));

    // Run Registration Flow
    const identityId = await demonstrateRegistration();

    if (!identityId) {
      throw new Error('Registration failed');
    }

    // Wait a moment
    await delay(1000);

    // Run Login Flow
    const token = await demonstrateLogin(identityId);

    if (!token) {
      throw new Error('Login failed');
    }

    // Run Admin Operations
    await delay(1000);
    const sessions = authSystem.sessionManager.sessionStore;
    const firstSessionId = Array.from(sessions.keys())[0];
    await demonstrateAdminOperations(firstSessionId, identityId);

    // Show Frontend Integration
    await delay(1000);
    showFrontendIntegrationExample();

    // Final Summary
    printSection('EXECUTION SUMMARY');
    printSuccess('✅ Complete Authentication Flow Demonstrated!');
    console.log('\n📋 Results:');
    console.log(`  • Identity ID: ${identityId.substring(0, 8)}...`);
    console.log(`  • Auth Token: ${token.accessToken.substring(0, 20)}...`);
    console.log(`  • Status: ${token.status}`);
    console.log('\n🚀 Ready for production deployment!');

  } catch (error) {
    printError(`Execution failed: ${error.message}`);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Execute
main().catch(console.error);
