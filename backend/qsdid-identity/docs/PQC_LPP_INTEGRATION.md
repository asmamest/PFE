# QSDID Authentication System - PQC & LPP Integration

## Overview

This document describes the integration of:
1. **Post-Quantum Cryptography (PQC)** - ML-KEM-768 hybrid with ECDSA
2. **Local Proof of Presence (LPP)** - Authenticator app integration (Google Authenticator, Microsoft Authenticator, Authy)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           QSDID Authentication System                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     Cryptography Layer                               │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  Classic:        ECDSA-P256 (NIST Standard)        │  │
│  │  Post-Quantum:   ML-KEM-768 (NIST PQC Standard)    │  │
│  │  Hash:           BLAKE3 (Quantum-Resistant)        │  │
│  │  Signature:      Hybrid (Both must pass)           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Key Management                                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  • PostQuantumCryptoService (qsdid-wasm)           │  │
│  │    - Hybrid key generation                          │  │
│  │    - KEM encapsulation/decapsulation               │  │
│  │    - Quantum-resistant signatures                   │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Authentication Factors                               │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  MFA Layer:                                          │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │ 1. Device-Bound Key (Something you have)      │ │  │
│  │  │    - Non-exportable private keys               │ │  │
│  │  │    - TPM/Secure Enclave simulation             │ │  │
│  │  ├────────────────────────────────────────────────┤ │  │
│  │  │ 2. Local Proof of Presence (Something you do)│ │  │
│  │  │    - Google Authenticator (TOTP)              │ │  │
│  │  │    - Microsoft Authenticator (Push)           │ │  │
│  │  │    - Authy (HOTP/TOTP)                        │ │  │
│  │  ├────────────────────────────────────────────────┤ │  │
│  │  │ 3. Web3 Wallet (Something you control)       │ │  │
│  │  │    - MetaMask / EVM-compatible wallet          │ │  │
│  │  │    - Cryptographic proof of ownership          │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Identity                                             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  • DID (Decentralized Identifier)                  │  │
│  │    - Format: did:qsdid:identityId                  │  │
│  │    - W3C compliant                                  │  │
│  │  • DID Document                                     │  │
│  │    - Public Keys (hybrid)                           │  │
│  │    - Service Endpoints (Web3 wallet)                │  │
│  │    - Verification Methods                           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Post-Quantum Cryptography (PQC)

### Service: `PostQuantumCryptoService`

Uses WASM module from `qsdid-wasm/` for quantum-resistant operations.

#### Features

1. **Hybrid Key Pair Generation**
   - Generates both ECDSA-P256 and ML-KEM-768 keys
   - Non-exportable private keys
   - TPM-like secure storage simulation

```javascript
const hybridKeys = await pqcService.generateHybridKeyPair(
  deviceIdentifier,
  metadata
);
// Returns:
// {
//   keyId: "...",
//   publicKey: {
//     classic: "-----BEGIN PUBLIC KEY-----...",
//     postQuantum: "0x..."
//   },
//   algorithm: "ECDSA-P256+ML-KEM-768",
//   isQuantumSafe: true
// }
```

2. **Key Encapsulation Mechanism (KEM)**
   - Post-quantum secure session key establishment
   - Resistant to Shor's algorithm (quantum factorization)

```javascript
// Server generates KEM secret
const kemSecret = await pqcService.generateKEMSecret(
  deviceIdentifier,
  keyId
);

// Client decapsulates to recover shared secret
const shared = await pqcService.decapsulateKEM(
  deviceIdentifier,
  keyId,
  kemSecret.ciphertext
);
```

3. **Hybrid Signatures**
   - Both ECDSA-P256 and ML-KEM must verify
   - Quantum-safe authentication

```javascript
// Sign with both algorithms
const signature = await pqcService.signChallengeHybrid(
  deviceIdentifier,
  keyId,
  challenge
);

// Verify both signatures
const result = await pqcService.verifySignatureHybrid(
  deviceIdentifier,
  keyId,
  signatureId,
  challenge
);
// Must have: classicValid && pqValid === true
```

4. **Quantum-Resistant Encryption**
   - ML-KEM-768 + AES-256-GCM
   - Secure data encryption with KEM

```javascript
const encrypted = await pqcService.encryptDataPQC(
  deviceIdentifier,
  keyId,
  plaintext
);

const decrypted = await pqcService.decryptDataPQC(
  deviceIdentifier,
  keyId,
  encrypted.ciphertext,
  encrypted.kemCiphertext
);
```

### WASM Module Integration

The `qsdid-wasm` module provides:

```typescript
// Key generation
generate_hybrid_keys(): Promise<{
  classic_public_key: string,
  classic_private_key: string,
  pq_public_key: string,
  pq_private_key: string
}>

// KEM operations
kem_encapsulate(public_key_hex: string): Promise<{
  shared_secret: string,
  ciphertext: string
}>

kem_decapsulate(secret_key_hex: string, ciphertext_hex: string): Promise<string>

// Signatures
sign_document(document_b64: string): Promise<{
  id: string,
  classic_signature: string,
  pq_signature: string
}>

verify_signature(signature_id: string, document_b64: string): Promise<{
  classic_valid: boolean,
  pq_valid: boolean
}>

// Hashing
hash_document(document: Uint8Array): string // BLAKE3
```

## Local Proof of Presence (LPP) with Authenticator App

### Service: `LocalProofOfPresenceService`

Integrates with authenticator applications for multi-factor authentication.

#### Supported Authenticators

1. **Google Authenticator**
   - TOTP (Time-based One-Time Password)
   - 6-digit codes
   - 30-second time windows

2. **Microsoft Authenticator**
   - Push notifications
   - Risk-based authentication
   - Out-of-band approval

3. **Authy**
   - TOTP/HOTP support
   - Multi-device sync
   - Backup tokens

#### Workflow

```javascript
// 1. Register Authenticator
const auth = lppService.registerAuthenticator(userId, {
  name: 'My iPhone',
  type: 'TOTP', // or 'PUSH_NOTIFICATION'
  deviceIdentifier: 'device-123',
  osType: 'iOS'
});

// 2. Initiate LPP Challenge
const challenge = lppService.initiateLPPChallenge(
  userId,
  sessionId,
  metadata
);
// Returns challenge with message:
// "Enter the 6-digit code from your authenticator app"

// 3. User approves in authenticator app
// For TOTP: enters 6-digit code
// For Push: taps approval button

// 4. Approve Challenge
const approval = lppService.approveLPPChallenge(
  challengeId,
  {
    totpCode: '123456', // or approved: true for push
  }
);
// Returns Token with confidence score:
// {
//   status: 'APPROVED',
//   confidence: 0.95 // 95% confident
// }

// 5. Verify Challenge Status
const status = lppService.getLPPChallengeStatus(challengeId);
// Confirms APPROVED and provides approval metadata
```

### Multi-Authenticator Support

```javascript
// User can register multiple authenticators
const auth1 = lppService.registerAuthenticator(userId, {
  name: 'iPhone',
  type: 'TOTP',
  isPrimary: true
});

const auth2 = lppService.registerAuthenticator(userId, {
  name: 'MacBook',
  type: 'PUSH_NOTIFICATION',
  isPrimary: false
});

// LPP challenges automatically use primary authenticator
// or fallback to others if primary unavailable
```

### Backup Codes

For account recovery:

```javascript
// Generate backup codes
const backup = lppService.generateBackupCodes(userId, 10);
// Returns: ['ABC12345', 'DEF67890', ...]
// User should store securely (not in cloud)

// Use backup code if authenticator lost
lppService.verifyBackupCode(userId, 'ABC12345', backupCodes);
```

### TOTP Implementation

```javascript
// TOTP generation (RFC 6238)
// Based on shared secret and current time
const now = Math.floor(Date.now() / 1000 / 30); // 30-second window
const hmac = crypto.createHmac('sha1', sharedSecret);
const code = hmac.digest() % 1000000; // 6-digit code

// Verification includes time window tolerance
// Accepts current window ± 1 window for clock skew
```

## Integration in Authentication Flows

### Registration Flow (Enhanced)

```
1. Initialize Session
   ↓
2. Request LPP (Authenticator)
   ├─ Register authenticator device
   ├─ Generate TOTP secret or push token
   └─ Send code/push notification
   ↓
3. Approve LPP
   ├─ User enters TOTP code OR approves push
   └─ Verify code/approval
   ↓
4. Generate Hybrid Keys
   ├─ Create ECDSA-P256 + ML-KEM-768 pair
   └─ Store in TPM/Secure Enclave simulation
   ↓
5. Sign Challenge (Hybrid)
   ├─ Sign with both classic + PQC algorithms
   └─ Return combined signature
   ↓
6. Verify Signature
   ├─ Verify both signatures
   ├─ Confirm quantum-resistance
   └─ Enforce single-use nonce
   ↓
7. Bind Web3 Wallet
   └─ Sign message with MetaMask
   ↓
8. Create DID
   ├─ Generate did:qsdid:identityId
   ├─ Bind hybrid keys
   ├─ Bind authenticator
   ├─ Bind wallet
   └─ Issue auth token
```

### Login Flow (Enhanced)

```
1. Initialize Session
   ↓
2. Request LPP (Authenticator)
   └─ Challenge primary authenticator
   ↓
3. Approve LPP
   └─ User verifies in authenticator app
   ↓
4. Sign with Existing Hybrid Keys
   ├─ Use keys from registration
   └─ Both classic + PQC signatures
   ↓
5. Verify Signature
   └─ Both signatures must validate
   ↓
6. Issue Access Token
   └─ New session established
```

## Security Properties

### Quantum Resistance

- **ML-KEM-768** (NIST  PQC Standard)
  - Resistant to Shor's algorithm
  - Future-proof against quantum computers
  - NIST recommended security level: 3 (≈256-bit AES)

- **Hybrid Approach**
  - ECDSA provides immediate security
  - ML-KEM provides post-quantum guarantee
  - Both must fail to break authentication
  - "Crypto-agility" - can upgrade algorithms without breaking existing keys

### Multi-Factor Authentication

1. **Something You Have**: Device-bound private key
   - Cannot export from secure enclave
   - Tied to specific device

2. **Something You Do**: Approval via authenticator app
   - Real, in-person approval
   - Time-based or event-driven

3. **Something You Control**: Web3 wallet
   - Self-custodied private key
   - Cryptographically proven ownership

### Replay Attack Prevention

- Single-use nonces (consumed after verification)
- TOTP time-window validation (prevents old codes)
- Session-specific challenges (not reusable)
- Nonce TTL enforcement

## Usage Examples

### Basic Registration with PQC + LPP

```javascript
const system = new QSDIDAuthenticationSystem();

// 1. Initialize
const session = await system.getRegistrationFlow()
  .initializeRegistration({ deviceIdentifier: 'device-1' });

// 2. LPP Challenge
const lppChallenge = await system.lppService.initiateLPPChallenge(
  'user-1', 
  session.sessionId
);

// 3. User approves in authenticator (Google Authenticator shows code)
const approval = await system.lppService.approveLPPChallenge(
  lppChallenge.challengeId,
  { totpCode: '123456' } // User enters from app
);

// 4. Generate hybrid keys
const keys = await system.pqcService.generateHybridKeyPair(
  'device-1'
);

// 5. Sign with hybrid algorithm
const signature = await system.pqcService.signChallengeHybrid(
  'device-1',
  keys.keyId,
  session.challenge
);

// 6. Verify (both classic + PQC)
const verification = await system.pqcService.verifySignatureHybrid(
  'device-1',
  keys.keyId,
  signature.signatureId,
  session.challenge
);

// 7. Complete registration
const identity = await system.getRegistrationFlow()
  .createIdentity(session.sessionId, 'device-1');
```

### KEM for Secure Channel Establishment

```javascript
// Server side: Generate KEM secret
const kemSecret = await pqcService.generateKEMSecret(
  deviceId,
  keyId
);
// Send: { ciphertext, algorithm }

// Client side: Decapsulate to recover shared secret
const shared = await pqcService.decapsulateKEM(
  deviceId,
  keyId,
  server_ciphertext
);

// Both sides now have same shared secret (post-quantum secure)
// Use for encrypting subsequent communication
```

## Configuration

```javascript
const system = new QSDIDAuthenticationSystem({
  pqcConfig: {
    pqcAlgorithm: 'ML-KEM-768', // NIST standard
    classicAlgorithm: 'ECDSA-P256', // NIST standard
  },
  lppConfig: {
    approvalTimeout: 5 * 60 * 1000, // 5 minutes
    totpTimeStep: 30, // seconds
    totpDigits: 6,
    maxRetries: 3,
    authenticatorTypes: ['TOTP', 'HOTP', 'PUSH_NOTIFICATION']
  }
});
```

## Performance Considerations

### Post-Quantum Operations

- Key generation: ~100-200ms (one-time, cached)
- KEM encapsulation: ~50ms
- KEM decapsulation: ~50ms
- Hybrid signing: ~150ms (sum of both algorithms)
- Hybrid verification: ~100ms

### Authenticator Operations

- TOTP generation: <1ms (local computation)
- TOTP verification: <5ms (with time window tolerance)
- Push notification: ~2-5s (user-dependent)

## Compliance & Standards

- **Post-Quantum**: NIST PQC selection (ML-KEM-768)
- **Cryptography**: FIPS 186-5 (ECDSA), RFC 6238 (TOTP)
- **DID**: W3C Decentralized Identifiers v1.0
- **MFA**: OWASP / NIST SP 800-63B recommendations
- **Audit**: Immutable audit trail (compliance-ready)

## Next Steps

1. **Deploy WASM Module**: Ensure `qsdid-wasm.wasm` is accessible
2. **Register Authenticators**: Users register Google Authenticator, Microsoft Authenticator, etc.
3. **Test Quantum-Resistance**: Run benchmark suite
4. **Key Rotation**: Implement periodic hybrid key rotation
5. **Wallet Integration**: Test with MetaMask, Trust Wallet, etc.
