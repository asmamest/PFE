# QSDID Production-Grade Authentication System - Architecture

## Overview

This is a **production-grade authentication system** combining:
- **Local Proof of Presence (LPP)** - Biometric/authenticator app-based verification
- **FIDO-like cryptographic authentication** - Device-bound asymmetric key pairs
- **Web3 wallet binding** - EVM wallet (MetaMask) binding and verification
- **Decentralized identity** - DID-compatible identity structures
- **Quantum-ready cryptography** - Post-quantum cryptographic support ready

The system is designed for **real-world deployment** with **strict security guarantees** and **immutable audit trails**.

---

## System Architecture

### Service-Oriented Architecture (SOA)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Flows                         │
│  ┌─────────────────────┐          ┌──────────────────────┐      │
│  │  Registration Flow  │          │    Login Flow        │      │
│  │  (9 Steps)          │          │    (6 Steps)         │      │
│  └──────────┬──────────┘          └──────────┬───────────┘      │
└─────────────┼──────────────────────────────┬──────────────────────┘
              │                              │
┌─────────────┴──────────────────────────────┴──────────────────────┐
│                    Event-Driven State Machine                      │
│  (Enforces deterministic transitions with audit trail)            │
└────────────────┬──────────────────────────────────────────────────┘
                 │
        ┌────────┴─────────────────────────────────┐
        │                                          │
┌───────▼────────────┐                   ┌────────▼────────────┐
│ Core Services      │                   │  Security Services  │
├────────────────────┤                   ├─────────────────────┤
│ 1. Session Mgmt    │                   │ 1. Audit Logging    │
│    - Challenge Gen │                   │    - Immutable Logs │
│    - Nonce Tracking│                   │    - Event Tracking │
│    - Replay Protect│                   │    - Security Events│
│                    │                   │                     │
│ 2. Key Management  │                   │ 2. Security Utils   │
│    - FIDO-like Gen │                   │    - Input Validate │
│    - TPM/SE Simul  │                   │    - Rate Limiting  │
│    - Signature Ops │                   │    - Data Masking   │
│                    │                   │                     │
│ 3. Wallet Binding  │                   │ 3. State Machine    │
│    - EVM Wallet    │                   │    - Transitions    │
│    - Web3 Integ    │                   │    - Validators     │
│    - Multi-Binding │                   │    - Middleware     │
│                    │                   │                     │
│ 4. Identity Svc    │                   │                     │
│    - DID Mgmt      │                   │                     │
│    - Device Track  │                   │                     │
│    - Profile Mgmt  │                   │                     │
└────────────────────┘                   └─────────────────────┘
```

### Core Services

#### 1. **Session Management Service**
- **Responsibility**: Authentication session lifecycle
- **Key Features**:
  - Cryptographically secure challenge/nonce generation
  - Session state tracking with expiration
  - Nonce uniqueness enforcement (replay protection)
  - Failed attempt tracking and lockout
  - Session binding to flow context

```
Challenge Generation → Session Creation → State Tracking → Expiration
```

**Replay Protection**:
- Each nonce is single-use (consumed after verification)
- Nonce tied to specific session
- TTL enforcement (10 minutes default)
- Tracking of consumed nonces prevents reuse

#### 2. **Key Management Service**
- **Responsibility**: Device-bound cryptographic operations
- **Implementation**: FIDO2-like asymmetric key pairs (ECDSA P-256)
- **Key Features**:
  - Key generation on device (non-exportable)
  - TPM/Secure Enclave simulation
  - Signature creation (private key never leaves secure context)
  - Signature verification (server-side)
  - Key rotation policies
  - Device identifier binding

**Design Principle**: Private keys are **NEVER** exported. Only signing capability is allowed.

#### 3. **Wallet Binding Service**
- **Responsibility**: Web3 wallet integration and verification
- **Features**:
  - MetaMask/EVM wallet connection challenges
  - Wallet signature verification
  - Multi-wallet binding per identity (configurable limit)
  - Primary wallet designation
  - Wallet revocation/unbinding

**Flow**:
```
Wallet Challenge → User Signs Message → Signature Verification → Binding
```

#### 4. **Identity Service**
- **Responsibility**: Persistent identity and DID management
- **Key Features**:
  - DID (Decentralized Identifier) generation
  - Identity binding to public keys, wallets, and devices
  - Device association tracking (pseudonymous)
  - Profile management
  - Identity revocation (irreversible)
  - DID document export (W3C format)

**DID Format**:
```
did:qsdid:{identity-short-id}
```

#### 5. **Audit Logging Service**
- **Responsibility**: Immutable event logging
- **Features**:
  - Structured logs with levels: [INFO], [SECURITY], [SUCCESS], [ERROR]
  - Structured categories: AUTHENTICATION, CRYPTOGRAPHY, WALLET_BINDING, etc.
  - Immutable log entries (cannot be modified)
  - Query by session, identity, time range
  - Security incident tracking
  - Background retention enforcement (90 days)

**Log Immutability**: Once written, logs cannot be modified or deleted programmatically.

---

## Authentication State Machine

**Deterministic, event-driven state transitions** with validation middleware.

### State Definitions

```
INIT
  ↓
CHALLENGE_GENERATED
  ├─→ SESSION_EXPIRED
  └─→ LPP_PENDING
      ├─→ LPP_REJECTED
      ├─→ SESSION_EXPIRED
      └─→ LPP_VERIFIED
          ├─→ KEY_GENERATED (registration only)
          │   ├─→ KEY_GENERATION_FAILED
          │   └─→ SIGNED
          │       ├─→ SIGNATURE_INVALID
          │       ├─→ REPLAY_DETECTED
          │       └─→ VERIFIED
          │           ├─→ WALLET_CONNECTIONS_PENDING
          │           │   ├─→ WALLET_CONNECTION_FAILED
          │           │   └─→ WALLET_CONNECTED
          │           │       └─→ IDENTITY_BOUND
          │           │           └─→ AUTHENTICATED
          │           └─→ AUTHENTICATED (already bound)
          │
          └─→ SIGNED (login with existing key)
              ├─→ SIGNATURE_INVALID
              ├─→ REPLAY_DETECTED
              └─→ VERIFIED
                  └─→ WALLET_CONNECTIONS_PENDING
```

### Transition Validation

Each transition can have **custom validators**:

```javascript
stateMachine.registerValidator(
  'VERIFIED',
  'WALLET_CONNECTIONS_PENDING',
  async (payload, context) => {
    // Custom validation logic
    return { valid: true/false, reason: '...' };
  }
);
```

---

## Authentication Flows

### Registration Flow (9 Steps)

```
1. Initialize Session
   └─→ Generate Challenge, Create Session ID

2. Request Local Proof of Presence (LPP)
   └─→ User receives LPP challenge on authenticator app

3. Approve LPP
   └─→ User approves using biometric/PIN

4. Generate Device Keys
   └─→ Create FIDO-like key pair on device (private key non-exportable)

5. Sign Challenge
   └─→ Device signs challenge using private key

6. Verify Signature (Server-side)
   └─→ Validate signature against public key
   └─→ Enforce nonce single-use (replay protection)

7. Initiate Wallet Binding
   └─→ Create wallet signature challenge

8. Complete Wallet Binding
   └─→ User signs challenge with MetaMask/wallet
   └─→ Bind wallet address to session

9. Create Identity & Issue Token
   └─→ Create persistent DID-based identity
   └─→ Bind public key, wallet, and device
   └─→ Generate authentication token
```

**Key Security Properties**:
- ✅ Nonce single-use enforcement (replay protection)
- ✅ Device-bound key pair (FIDO-like)
- ✅ Mandatory wallet binding
- ✅ Explicit LPP verification
- ✅ Deterministic state transitions
- ✅ Immutable audit trail

### Login Flow (6 Steps)

```
1. Initialize Session
   └─→ Generate new challenge

2. Request LPP
   └─→ User approves via authenticator app

3. Approve LPP
   └─→ User grants approval

4. Sign Challenge
   └─→ Use existing device key to sign

5. Verify Signature
   └─→ Server validates against stored public key
   └─→ Replay protection

6. Verify Wallet & Issue Token
   └─→ Ensure wallet still bound
   └─→ Issue authenticated session token
```

---

## Security Model

### 1. Challenge-Response Authentication
- **Nonce generation**: 32 bytes (256 bits) cryptographically secure
- **Nonce TTL**: 10 minutes
- **Single-use enforcement**: Consumed after first use
- **Validation**: `validateAndConsumNonce()` enforces uniqueness

### 2. Device-Bound Keys (FIDO-like)

Mimics FIDO2 authentication:

```
Device Side:
├─ Generate key pair locally (P-256 ECDSA)
├─ Store private key in secure enclave (simulated)
├─ Private key NEVER exported
└─ Only signing capability available

Server Side:
├─ Store public key
├─ Verify signatures
└─ Never sees private key
```

### 3. Replay Attack Prevention

**Single-Use Nonce Pattern**:
```
1. Nonce created in CHALLENGE_GENERATED state
2. Nonce marked as "used=false"
3. During verification: validateAndConsumNonce()
   - Check: nonce exists AND belongs to session AND not used
   - Check: nonce not expired
   - Action: Mark used=true
4. Any replay attempt fails: "NONCE_ALREADY_USED"
```

### 4. Session Integrity

- **Session timeout**: 5 minutes default
- **Failed attempt lockout**: After 5 failures, 15-minute lockout
- **Session revocation**: Admin can revoke (irreversible)
- **State tracking**: Previous states recorded

### 5. Wallet Binding Security

- **Challenge-response**: Wallet must sign message
- **Signature verification**: Recovered address must match
- **Binding enforcement**: No naked access with unbound wallet
- **Multi-wallet support**: Up to 3 wallets per identity

### 6. Audit Trail

**Every action logs**:
```
[INFO/SECURITY/SUCCESS/ERROR], [Category], Timestamp, Details

Examples:
[SUCCESS] AUTHENTICATION: sessionId=..., identityId=..., method=FIDO-like
[SECURITY] SECURITY_INCIDENT: incidentType=REPLAY_ATTACK_DETECTED, severity=HIGH
[ERROR] CRYPTOGRAPHY: operation=SIGNATURE_VERIFICATION, status=INVALID
```

**Immutable**: Once written, cannot be modified.

---

## Error Handling Strategy

### Error Classification

```
ERROR TYPES:
├─ SECURITY (High Priority)
│  ├─ Replay attack detected
│  ├─ Signature verification failed
│  └─ Session lockout triggered
│
├─ SESSION (Medium Priority)
│  ├─ Session expired
│  ├─ Session not found
│  └─ Nonce validation failed
│
├─ CRYPTOGRAPHY (High Priority)
│  ├─ Key generation failed
│  ├─ Key not found
│  └─ Signature creation failed
│
├─ WALLET (Medium Priority)
│  ├─ Wallet not bound
│  ├─ Wallet signature invalid
│  └─ Wallet challenge expired
│
├─ IDENTITY (Medium Priority)
│  ├─ Identity not found
│  ├─ Identity revoked
│  └─ Identity inactive
│
└─ VALIDATION (Low Priority)
   ├─ Invalid input format
   ├─ Input validation failed
   └─ Schema mismatch
```

### Recovery Strategies

| Error | Recovery Strategy |
|-------|-------------------|
| Session expired | Re-initialize authentication |
| Nonce already used (replay) | Log security incident, deny request |
| Signature invalid | Return error with hint to retry |
| Wallet not bound | Offer wallet binding initiation |
| Identity revoked | Deny access, log incident |
| Failed attempts (5+) | Enforce 15-min lockout |

---

## Integration Points

### 1. With Existing Rust Identity System
The Node.js authentication layer will:
- Call Rust identity modules for DID validation
- Interface with PQC verification module
- Store identity records in shared database

### 2. With QSDID-WASM
- Use post-quantum cryptographic functions when available
- Fallback to Node.js crypto for ECDSA-based operations
- Can be extended for ML-DSA, ML-KEM verification

### 3. With Blockchain/Smart Contracts
- Export DID document to blockchain
- Store identity root hash on-chain
- Verify wallet bindings on-chain (optional)

---

## Deployment Considerations

### Production Requirements

1. **Key Storage**:
   - Prod: Hardware TPM or Secure Enclave
   - Current: In-memory simulation (NOT FOR PRODUCTION)

2. **Session Store**:
   - Prod: Redis or database
   - Current: In-memory Map

3. **Audit Logs**:
   - Prod: Persistent database + immutable append-only log
   - Current: In-memory array

4. **Nonce Store**:
   - Prod: Redis with TTL
   - Current: In-memory Map

### Recommended Architecture for Production

```
┌────────────────────────────────────────┐
│   Load Balancer (sticky sessions)      │
└────────────┬─────────────────────────────┘
             │
        ┌────┴──────────────────┐
        │                       │
┌───────▼──────┐      ┌────────▼────────┐
│  Auth Nodes  │      │  Auth Nodes     │
│  (Multiple)  │      │  (Replicas)     │
└────┬────┬────┘      └────┬───┬────────┘
     │    │                │   │
     └────┼────────────────┼───┘
          │                │
     ┌────▼────────────────▼────┐
     │   Redis Cluster           │
     │ (Sessions + Nonces + Locks)
     └───────────────────────────┘
          │
     ┌────▼──────────────────────┐
     │  PostgreSQL Cluster       │
     │  (Identities + Audit Logs)│
     └───────────────────────────┘
```

---

## Performance Characteristics

### Latency (Expected)

| Operation | Latency |
|-----------|---------|
| Challenge generation | < 1ms |
| Session creation | < 5ms |
| Signature verification | < 50ms |
| Identity creation | < 100ms |
| Wallet binding | < 200ms (depends on network) |
| **Total Registration** | < 2-3s (assuming user timestamps) |
| **Total Login** | < 1-2s |

### Throughput

- **Single node**: ~1000 auth attempts/second
- **Cluster of 10 nodes**: ~10,000 auth attempts/second
- **Depends on**: Key store speed, signature verification speed

---

## Future Enhancements

1. **Biometric Integration**
   - Direct fingerprint/face verification
   - Hardware-backed biometric storage

2. **Post-Quantum Cryptography**
   - ML-DSA for signatures
   - ML-KEM for key encapsulation

3. **Decentralized Key Recovery**
   - Shamir's secret sharing
   - Social recovery via trusted contacts

4. **Enhanced Wallet Features**
   - Multi-sig wallets
   - Hardware wallet integration

5. **Rate Limiting & DDoS Protection**
   - Distributed rate limiting
   - Captcha integration

---

## References

- [FIDO2 Specification](https://fidoalliance.org/fido2/)
- [W3C DID Spec](https://www.w3.org/TR/did-core/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
