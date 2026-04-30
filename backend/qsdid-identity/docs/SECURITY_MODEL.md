# QSDID Authentication System - Security Model

## Executive Summary

This document defines the **security guarantees** and **threat model** for the QSDID Production-Grade Authentication System.

**Key Security Properties**:
- ✅ **User Presence Verification** - Mandatory biometric/authenticator app approval
- ✅ **Device-Bound Authentication** - Private keys never leave device
- ✅ **Replay Attack Prevention** - Single-use nonces enforced at infrastructure level
- ✅ **Signature Verification** - Server validates all cryptographic operations
- ✅ **Immutable Audit Trail** - All events logged with tamper-evident properties
- ✅ **Session Integrity** - Deterministic state machine prevents bypasses
- ✅ **Wallet Binding** - Mandatory Web3 wallet connection to prevent sybil attacks

---

## Threat Model

### Assumptions

**Trust Boundaries**:
- ✅ Device OS is trusted (TPM/Secure Enclave backing)
- ✅ Private keys cannot be exported from device
- ✅ Authentication app cannot be compromised
- ✅ Server infrastructure is secure
- ❌ Network is NOT trusted (all messages can be intercepted)
- ❌ Client user interface cannot be trusted

**Attacker Capabilities**:
- Network eavesdropping (can see all traffic)
- Man-in-the-middle attacks (can intercept and modify requests)
- Replay attacks (can reuse captured messages)
- Session hijacking attempts
- Brute force attempts
- Social engineering
- Side-channel attacks (timing, cache, etc.)

### In-Scope Threats

1. **Replay Attacks**
   - Attacker captures valid authentication request
   - Attacker replays request to gain access
   - **Mitigation**: Single-use nonce enforcement

2. **Signature Forgery**
   - Attacker attempts to forge cryptographic signatures
   - **Mitigation**: ECDSA-based signatures with server verification

3. **Private Key Extraction**
   - Attacker attempts to extract device private key
   - **Mitigation**: Keys stored in TPM/Secure Enclave, never exported

4. **Man-in-the-Middle (MITM)**
   - Attacker intercepts challenge/challenge
   - **Mitigation**: Challenge-response protocol with cryptographic binding

5. **Session Hijacking**
   - Attacker attempts to reuse valid session token
   - **Mitigation**: Short expiration, device binding, wallet verification

6. **Brute Force Attempts**
   - Attacker attempts multiple authentication attempts
   - **Mitigation**: Failed attempt lockout (5 attempts → 15 min lockout)

7. **Sybil Attacks**
   - Attacker creates multiple fake identities
   - **Mitigation**: Wallet binding (requires unique blockchain address)

### Out-of-Scope Threats

❌ **Insider Threats**: Compromised server administrators
❌ **Hardware Compromise**: Physical tampering with device
❌ **Supply Chain Attacks**: Compromised cryptographic libraries
❌ **Quantum Computing**: Post-quantum cryptography needed in future
❌ **Social Engineering**: User shares credentials (user responsibility)

---

## Cryptographic Guarantees

### 1. Challenge-Response Protocol

**Design**:
```
Server → Device: challenge = random(32 bytes)
Device → Server: signature = Sign(challenge, device_private_key)
Server: Verify(signature, challenge, device_public_key)
```

**Security Property**: 
- Proves device possession (can sign challenges)
- Prevents offline attacks (must respond to server challenge)
- Nonce binding prevents reuse

**Implementation**:
- Algorithm: ECDSA over P-256 (FIDO2 standard)
- Hash: SHA-256
- Server verifies signature against stored public key

### 2. Nonce (Number Used Once) Management

**Requirements**:
1. Unique per session
2. Single-use enforcement
3. Expiration enforcement
4. Binding to session context

**Implementation**:

```javascript
Nonce Generation:
├─ Source: crypto.randomBytes(32)
├─ Format: Hexadecimal string (64 characters)
└─ Entropy: 256 bits

Nonce Storage:
├─ SessionStore: nonce → { sessionId, createdAt, expiresAt, used: false }
└─ Cleanup: TTL-based expiration (10 minutes)

Nonce Validation:
├─ Check: nonce exists in store
├─ Check: nonce.sessionId === currentSession.id
├─ Check: currentTime < nonce.expiresAt
├─ Check: nonce.used === false
├─ Action: Set nonce.used = true (mark consumed)
└─ Result: Grant access or deny
```

**Replay Protection**:
```
Attack Attempt:
1. Attacker captures: Request { challenge, signature }
2. Attacker resends: Same request 5 minutes later
3. Server checks: nonce already marked as used
4. Result: NONCE_ALREADY_USED → Access DENIED
5. Event: logSecurityIncident('REPLAY_ATTACK_DETECTED', severity=HIGH)
```

### 3. Device-Bound Key Pairs (FIDO-like)

**Key Generation**:
```
Device Side:
├─ Generate private key ✓ (on secure hardware)
├─ Generate public key ✓ (from private key)
├─ Store private key (non-exportable) ✓
├─ Return public key to server ✓
└─ NO export of private key ✗

Server Side:
├─ Store public key
├─ Use for signature verification
└─ Never sees private key
```

**Security Properties**:
- Private key only on device (cannot be stolen from server)
- Non-exportable (cannot be copied/transferred)
- Device-bound (only device can sign)
- Revocable (can disable key without device access)

**Key Rotation**:
```
1. Generate new key pair on device
2. Sign new public key with old private key
3. Server verifies proof of possession
4. Mark old key as revoked
5. Activate new key
6. Device deletes old private key
```

### 4. Session Integrity

**State Machine**:
- Linear progression (no backwards transitions)
- Event-driven (no automatic transitions)
- Validator functions (custom business logic)
- Immutable history (all transitions recorded)

**Attack Prevention**:
```
Bypass Attempt: Skip LPP verification
├─ Attacker tries: transition from CHALLENGE_GENERATED → SIGNED
├─ State Machine checks: StateTransitions[CHALLENGE_GENERATED]
├─ Result: ['LPP_PENDING'] - SIGNED not allowed
└─ Outcome: Invalid transition → Access DENIED

Bypass Attempt: Reuse old session
├─ Attacker tries: Use expired session
├─ Session Manager checks: currentTime < session.expiresAt
├─ Result: SESSION_EXPIRED
└─ Outcome: Access DENIED
```

### 5. Wallet Binding

**Web3 Integration**:
```
Challenge: "Sign this message to bind your wallet..."
Signature: wallet.sign(challenge)
Recovery: recover_address(challenge, signature)
Validation: recovered_address == claimed_address
```

**Security Property**:
- Proves wallet ownership (must sign challenge)
- Prevents sybil attacks (unique blockchain address)
- Mandatory for registration (cannot skip)
- Multi-wallet support (configurable limit)

**Attack Prevention**:
```
Attempt: Bind without valid signature
├─ Attacker provides: walletAddress, invalidSignature
├─ Server: recoveredAddr = recover(challenge, signature)
├─ Check: recoveredAddr != walletAddress
└─ Result: WALLET_SIGNATURE_VERIFICATION_FAILED

Attempt: Bind other user's wallet
├─ Attacker provides: victim_walletAddress, valid_victim_signature
├─ Issue: Signature is tied to specific sessionId + timestamp
├─ Check: Signature timestamp doesn't match expected window
└─ Result: WALLET_SIGNATURE_VERIFICATION_FAILED
```

---

## Audit Trail Guarantees

### Immutable Logging

**Log Entry Structure**:
```javascript
{
  logId: 'log_1234567890_abc123',
  level: '[INFO|SECURITY|SUCCESS|ERROR]',
  category: 'AUTHENTICATION|CRYPTOGRAPHY|WALLET_BINDING|IDENTITY',
  timestamp: 1234567890,
  details: { /* event-specific data */ },
  immutable: true  // Flag: cannot be modified after creation
}
```

**Immutability Enforcement**:
- Once written: Cannot modify
- Once written: Cannot delete
- Once written: Cannot suppress
- Storage: Append-only log (database)
- Persistence: Long-term retention (90+ days recommended)

**Security Events Logged**:

| Event | Severity | Details |
|-------|----------|---------|
| REPLAY_ATTACK_DETECTED | HIGH | sessionId, nonce, timestamp |
| SIGNATURE_VERIFICATION_FAILED | HIGH | device, challenge, reason |
| SESSION_LOCKED | MEDIUM | sessionId, failedAttempts |
| WALLET_BINDING_FAILURE | MEDIUM | identityId, walletAddress, reason |
| IDENTITY_REVOKED | MEDIUM | identityId, reason |
| SESSION_REVOKED | MEDIUM | sessionId, revokedBy |

---

## Attack Scenarios & Mitigations

### Scenario 1: Replay Attack

**Attack**:
```
1. Alice authenticates successfully
2. Attacker captures: POST /verify { challenge, signature, sessionId }
3. Attacker replays same request 2 minutes later
4. Server processes with same challenge
```

**Mitigation**:
```
At Step 4:
1. Session Manager: validateAndConsumNonce(sessionId, challenge)
2. Check: nonce exists AND sessionId matches AND nonce.used === false
3. If valid: nonce.used = true (consume)
4. If already used: NONCE_ALREADY_USED error
5. Audit: logSecurityIncident('REPLAY_ATTACK_DETECTED', severity=HIGH)
7. Result: Attack FAILED
```

**Detection**:
- Query audit logs for `REPLAY_ATTACK_DETECTED` entries
- Trigger alert if >1 replay attempt in 5 minutes
- Block IP for 1 hour after 3 replay attempts

### Scenario 2: Session Hijacking

**Attack**:
```
1. Alice logs in successfully
2. Attacker intercepts auth token
3. Attacker uses token with different device
4. Server grants access
```

**Mitigation**:
```
1. At registration: Device identifier bound to identity
2. At login: Require same device signing capability
3. If token used from different device:
   - Challenge requires signature from original device
   - Different device cannot produce valid signature
   - Request FAILS: Device mismatch
4. Audit: logAuthentication('DEVICE_MISMATCH', severity=HIGH)
```

**Additional Defenses**:
- Token contains device identifier (not transferable)
- Token TTL = 1 hour (need re-authentication)
- Token includes IP context (can detect unusual geography)

### Scenario 3: Private Key Extraction

**Attack**:
```
1. Attacker compromises device OS
2. Attacker attempts to extract device private key
3. Attacker uses key to sign challenges for any session
```

**Mitigation**:
```
Hardware Level:
├─ Private keys stored in TPM/Secure Enclave
├─ Secure hardware prevents extraction
├─ Only signing capability exposes via APIs
└─ No key material in main memory

Software Level:
├─ After each use: wipe from memory
├─ Encrypt key at rest
└─ Rate limit signing operations

Detection:
├─ Unusual signing patterns trigger alert
├─ Multiple sessions signing in seconds → suspicious
└─ Audit logs track all signing operations
```

### Scenario 4: Brute Force Password/PIN

**Attack**:
```
1. Attacker obtains user email/device ID
2. Attacker initiates 100 registration attempts
3. Attacker tries random authentication codes
```

**Mitigation**:
```
Rate Limiting:
├─ Max 5 failed attempts per session
├─ After 5 failures: Lock session for 15 minutes
├─ Rate limit per IP: 10 sessions/minute
├─ Rate limit per device: 20 attempts/hour

Detection:
├─ Query: Failed authentication attempts by IP
├─ If >20 failures in 5 minutes: Block IP for 1 hour
└─ Alert admin on pattern

Response:
├─ Log: logSessionLockout(sessionId, reason)
└─ User: Clear UI, suggest "Try again later"
```

### Scenario 5: Sybil Attack (Multiple Fake Identities)

**Attack**:
```
1. Attacker creates 1000 identities
2. Each identity used to spam/attack internal systems
```

**Mitigation**:
```
1. Wallet Binding: Each identity requires unique EVM wallet
2. Constraint: 1 identity = 1 wallet address
3. Result: 1000 identities require 1000 blockchain addresses
4. Cost: 1000 × (gas fees + collateral deposit) = expensive
5. Detection: Monitor for addresses with unusual activity

Monitoring:
├─ Alert if single IP creates >5 identities/day
├─ Alert if identities created with throwaway wallets
└─ Manual review for pattern analysis
```

---

## Compliance & Standards

### Standards Adherence

- **FIDO2**: Username password-less authentication with device binding
- **W3C DID**: Decentralized identity specification
- **OWASP**: Authentication best practices and security guidelines
- **NIST SP 800-63B**: Authentication and lifecycle management

### Security Checklist

- [x] Nonce uniqueness enforcement
- [x] Replay attack prevention
- [x] Cryptographic signature verification
- [x] Device-bound authentication
- [x] Session timeout policy
- [x] Failed attempt lockout
- [x] Immutable audit logging
- [x] Multi-factor authentication (LPP)
- [x] No password storage (FIDO-like)
- [x] Wallet binding (prevents sybil)
- [x] State machine prevents bypasses
- [x] Deterministic error handling

---

## Security Recommendations for Production

### 1. Key Storage

**Current**: In-memory simulation (NOT PRODUCTION)
**Recommended**: 
- TPM 2.0 (Windows/Linux)
- Secure Enclave (iOS/macOS)
- StrongBox/KeyStore (Android)

### 2. Session & Nonce Store

**Current**: In-memory Map
**Recommended**:
- Redis Cluster with TTL enforcement
- PostgreSQL with index on `expiresAt`
- Memcached with replication

### 3. Audit Log Storage

**Current**: In-memory array
**Recommended**:
- TimescaleDB (time-series optimized)
- ClickHouse (analytics warehouse)
- Separate audit database for compliance
- Immutable append-only log (Kafka, EventStoreDB)

### 4. Network Security

- HTTPS only (TLS 1.3+)
- Certificate pinning for mobile apps
- HSTS headers
- CORS policy (restrict origins)
- API rate limiting per IP + per user

### 5. Monitoring & Alerting

```javascript
// Real-time alerts
├─ Replay attack detected → Alert immediately
├─ >5 failed login attempts → Alert + block IP
├─ Signature verification failures (10+ in 5min) → Alert
├─ Identity revocation requests → Audit trail
└─ Unusual device/location → Require MFA confirmation
```

### 6. Incident Response

```
Detected Incident:
1. Identify: Query audit logs
2. Isolate: Revoke affected session/identity
3. Analyze: Extract logs and metadata
4. contain: Block IP/device if needed
5. Notify: Alert user and admin
6. Review: Post-incident analysis
```

---

## Cryptographic Agility

### Future: Post-Quantum Cryptography

**Current**: ECDSA-P256 (quantum-vulnerable)
**Future**: ML-DSA/ML-KEM (NIST PQC winners)

**Migration Strategy**:
```
Phase 1: Support both schemes
├─ Server accepts ECDSA + ML-DSA signatures
├─ Client chooses scheme during registration
└─ Per-identity crypto configuration

Phase 2: Encourage migration
├─ New registrations default to ML-DSA
├─ Notify users: "Upgrade to post-quantum"
└─ Provide upgrade endpoint

Phase 3: Phase out ECDSA
├─ Deprecation period: 2 years
├─ Final sunset: January 2030 (example)
└─ Migrate all keys to ML-DSA
```

---

## Security Incident Response

### Reporting Security Issues

**Do NOT** disclose security vulnerabilities publicly.

Contact: `security@qsdid-platform.com`

Include:
- Vulnerability description
- Attack steps to reproduce
- Impact assessment
- Suggested fix (optional)

**Response Timeline**:
- Initial response: 24 hours
- Fix development: 7-14 days
- Security patch release: 30-90 days

---

## References

- [FIDO2 Specification](https://fidoalliance.org/fido2/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST SP 800-63 Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [RFC 4648 - Base Encoding](https://tools.ietf.org/html/rfc4648)
