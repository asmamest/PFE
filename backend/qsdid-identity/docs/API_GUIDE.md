# QSDID Authentication System - API Guide

## Quick Start

### Installation

```bash
npm install qsdid-identity
```

### Initialization

```javascript
import { QSDIDAuthenticationSystem } from './qsdid-identity/src/index.js';

const authSystem = new QSDIDAuthenticationSystem({
  sessionConfig: {
    sessionTimeout: 5 * 60 * 1000, // 5 minutes
    nonceTTL: 10 * 60 * 1000,      // 10 minutes
    maxAttempts: 5,
  },
  keyConfig: {
    keyRotationPolicy: 90 * 24 * 60 * 60 * 1000, // 90 days
    maxKeysPerDevice: 5,
  },
  walletConfig: {
    walletVerificationTimeout: 5 * 60 * 1000,
    maxWalletsPerIdentity: 3,
  },
});
```

---

## Registration Flow API

### Step 1: Initialize Registration

```javascript
const registration = authSystem.getRegistrationFlow();

const session = await registration.initializeRegistration({
  deviceIdentifier: 'device-123',
  osType: 'iOS',
  deviceModel: 'iPhone 14',
});

// Response:
// {
//   sessionId: 'uuid',
//   challenge: '0x1234...', // Hex string (32+ bytes)
//   expiresAt: 1234567890,
//   status: 'CHALLENGE_GENERATED'
// }
```

### Step 2: Request Local Proof of Presence

```javascript
const lppRequest = await registration.requestLocalProofOfPresence(
  session.sessionId
);

// Response:
// {
//   sessionId: 'uuid',
//   lppChallengeId: 'lpp_...',
//   status: 'LPP_PENDING',
//   message: 'Check your authenticator app...'
// }
```

**Client-side**:
- User receives push notification on authenticator app
- User approves with fingerprint/PIN
- App returns approval token

### Step 3: Approve Local Proof of Presence

```javascript
const approvalToken = getUserApprovalToken(); // From authenticator app

const lppApproval = await registration.approveLocalProofOfPresence(
  session.sessionId,
  approvalToken
);

// Response:
// {
//   sessionId: 'uuid',
//   status: 'LPP_VERIFIED',
//   nextStep: 'Generate device keys'
// }
```

### Step 4: Generate Device Keys

```javascript
const keyGeneration = await registration.generateDeviceKeys(
  session.sessionId,
  'device-123',
  {
    hardware: 'TPM2.0', // or 'SecureEnclave'
    osType: 'iOS',
  }
);

// Response:
// {
//   sessionId: 'uuid',
//   keyId: 'key-abc123',
//   publicKey: '-----BEGIN PUBLIC KEY-----\n...',
//   status: 'KEY_GENERATED',
//   nextStep: 'Sign challenge'
// }
```

**Security Note**: Private key is generated and stored on device. NEVER transmitted.

### Step 5: Sign Challenge

```javascript
// Client-side: Use device private key to sign challenge
const signature = await device.signWithPrivateKey(
  session.challenge,
  keyGeneration.keyId
);

const signedChallenge = await registration.signChallenge(
  session.sessionId,
  'device-123',
  keyGeneration.keyId
  // Signature is generated on device, returned to server
);

// Response:
// {
//   sessionId: 'uuid',
//   signature: '0x1234...',
//   algorithm: 'ECDSA-SHA256',
//   status: 'SIGNED',
//   nextStep: 'Verify signature'
// }
```

### Step 6: Verify Signature (Server-side)

```javascript
const verification = await registration.verifySignature(
  session.sessionId,
  'device-123',
  keyGeneration.keyId,
  signedChallenge.signature
);

// Response:
// {
//   sessionId: 'uuid',
//   verified: true,
//   status: 'VERIFIED',
//   nextStep: 'Connect wallet'
// }

// Error cases:
// - Signature invalid: "Signature verification failed"
// - Replay attack: "Nonce has already been consumed"
// - Session expired: "Session has expired"
```

### Step 7: Initiate Wallet Binding

```javascript
const walletChallenge = await registration.initiateWalletBinding(
  session.sessionId
);

// Response:
// {
//   sessionId: 'uuid',
//   challengeId: 'challenge-...',
//   message: 'Sign this message to bind your wallet...',
//   expiresAt: 1234567890,
//   status: 'WALLET_BINDING_PENDING'
// }
```

**Client-side**:
- Display message to user
- User signs with MetaMask wallet
- Extract wallet address and signature

### Step 8: Complete Wallet Binding

```javascript
const walletBinding = await registration.completeWalletBinding(
  session.sessionId,
  '0x742d35Cc6634C0532925a3b844Bc0e8b8a54d59d', // Wallet address
  '0x1234...', // Signature
  walletChallenge.challengeId
);

// Response:
// {
//   sessionId: 'uuid',
//   walletAddress: '0x742d35Cc...',
//   status: 'WALLET_CONNECTED',
//   nextStep: 'Create identity'
// }
```

### Step 9: Create Identity (Final)

```javascript
const identity = await registration.createIdentity(
  session.sessionId,
  'device-123'
);

// Response:
// {
//   sessionId: 'uuid',
//   identityId: 'identity-uuid',
//   did: 'did:qsdid:identity-uuid',
//   authToken: 'auth_...',
//   status: 'AUTHENTICATED',
//   profile: {
//     publicKey: '-----BEGIN PUBLIC KEY-----\n...',
//     walletAddress: '0x742d35Cc...',
//     created: 1234567890
//   }
// }
```

**Success!** User is now registered and authenticated.

---

## Login Flow API

### Step 1: Initialize Login

```javascript
const login = authSystem.getLoginFlow();

const session = await login.initializeLogin({
  deviceIdentifier: 'device-123',
});

// Response: Same as registration step 1
```

### Step 2-3: LPP Request & Approval

```javascript
const lppRequest = await login.requestLocalProofOfPresence(
  session.sessionId
);

const lppApproval = await login.approveLocalProofOfPresence(
  session.sessionId,
  approvalToken
);
```

### Step 4: Sign Challenge

```javascript
// Use existing device key (stored from registration)
const signedChallenge = await login.signChallenge(
  session.sessionId,
  'device-123',
  'key-abc123' // From registration
);
```

### Step 5: Verify Signature

```javascript
const verification = await login.verifySignature(
  session.sessionId,
  'device-123',
  'key-abc123',
  signedChallenge.signature
);
```

### Step 6: Verify Wallet & Issue Token

```javascript
// Check wallet is still bound
const walletVerification = await login.verifyWalletBinding(
  session.sessionId,
  'identity-uuid', // From previous login
  '0x742d35Cc...' // Previous wallet address
);

if (walletVerification.walletBound) {
  // Wallet is bound, issue token
  const token = await login.issueAccessToken(
    session.sessionId,
    'identity-uuid'
  );

  // Response:
  // {
  //   sessionId: 'uuid',
  //   identityId: 'identity-uuid',
  //   did: 'did:qsdid:...',
  //   accessToken: 'access_...',
  //   tokenType: 'Bearer',
  //   expiresIn: 3600,
  //   status: 'AUTHENTICATED'
  // }
} else {
  // Wallet needs rebinding
  const challenge = await registration.initiateWalletBinding(
    session.sessionId
  );
  // ... repeat wallet binding steps
}
```

---

## Query & Admin APIs

### Check Authentication Status

```javascript
const status = authSystem.getAuthenticationStatus(sessionId);

// Response:
// {
//   sessionId: 'uuid',
//   status: 'AUTHENTICATED',
//   createdAt: 1234567890,
//   expiresAt: 1234567890,
//   flowType: 'registration'
// }
```

### Verify Identity

```javascript
const identity = authSystem.verifyIdentity(identityId);

// Response:
// {
//   valid: true,
//   identityId: 'uuid',
//   did: 'did:qsdid:...',
//   status: 'ACTIVE',
//   verificationStatus: 'VERIFIED'
// }
```

### Get Audit Logs

```javascript
// Session logs
const sessionLogs = authSystem.getSessionAuditLog(sessionId);

// Identity logs
const identityLogs = authSystem.getIdentityAuditLog(identityId);

// Security incidents (last 24 hours)
const incidents = authSystem.getSecurityIncidents(24);

// Response (logs):
// [
//   {
//     level: '[SUCCESS]',
//     category: 'AUTHENTICATION',
//     timestamp: 1234567890,
//     details: { result: 'SUCCESS', sessionId: '...', method: 'FIDO-like' }
//   },
//   ...
// ]
```

### System Metrics

```javascript
const metrics = authSystem.getSystemMetrics();

// Response:
// {
//   sessions: {
//     activeSessions: 42,
//     registrationSessions: 5,
//     loginSessions: 37,
//     lockedSessions: 0
//   },
//   identities: [
//     { identityId: '...', did: 'did:qsdid:...', created: ... },
//     ...
//   ]
// }
```

### Admin: Revoke Identity

```javascript
// Irreversible operation
const revocation = authSystem.revokeIdentity(
  identityId,
  'Suspicious activity detected'
);

// Response:
// {
//   identityId: 'uuid',
//   status: 'REVOKED',
//   revokedAt: 1234567890
// }
```

### Admin: Revoke Session

```javascript
const revocation = authSystem.revokeSession(
  sessionId,
  'Administrative order'
);

// Response:
// {
//   sessionId: 'uuid',
//   isRevoked: true,
//   revocationReason: 'Administrative order'
// }
```

### Export DID Document

```javascript
const didDoc = authSystem.exportDIDDocument(identityId);

// Response (W3C DID Document):
// {
//   "@context": "https://www.w3.org/ns/did/v1",
//   "id": "did:qsdid:...",
//   "publicKey": [...],
//   "authentication": [...],
//   "service": [
//     {
//       "type": "Web3Account",
//       "serviceEndpoint": "0x742d35Cc..."
//     }
//   ],
//   "created": "2024-01-15T10:00:00Z",
//   "updated": "2024-01-15T10:00:00Z"
// }
```

### Health Check

```javascript
const health = authSystem.getHealthStatus();

// Response:
// {
//   status: 'HEALTHY',
//   timestamp: '2024-01-15T10:00:00Z',
//   components: {
//     sessionManager: 'OK',
//     keyManager: 'OK',
//     walletBinding: 'OK',
//     identityService: 'OK',
//     auditLogger: 'OK',
//     stateMachine: 'OK'
//   },
//   metrics: {
//     sessions: 42,
//     identities: 150
//   }
// }
```

---

## Error Handling

### Common Errors

```javascript
try {
  await registration.verifySignature(
    sessionId,
    deviceId,
    keyId,
    invalidSignature
  );
} catch (error) {
  // error.code: 'SIGNATURE_VERIFICATION_FAILED'
  // error.message: 'Signature verification failed'
  
  switch (error.code) {
    case 'SESSION_NOT_FOUND':
      // Re-initialize session
      break;
    case 'SESSION_EXPIRED':
      // Start new authentication
      break;
    case 'NONCE_ALREADY_USED':
      // SECURITY INCIDENT: Log and deny
      logSecurityIncident('REPLAY_ATTACK', error);
      break;
    case 'INVALID_NONCE':
      // Validation error, retry
      break;
    case 'SIGNATURE_VERIFICATION_FAILED':
      // Cryptographic failure, user can retry
      break;
    case 'MAX_ATTEMPTS_EXCEEDED':
      // Session locked for 15 minutes
      break;
  }
}
```

---

## Best Practices

1. **Session Management**
   - Always initialize a new session for each authentication attempt
   - Do not reuse challenges or nonces
   - Clean up expired sessions (automatic via background job)

2. **Error Handling**
   - Never expose internal error details to clients
   - Log all security incidents
   - Implement exponential backoff for retries

3. **Key Management**
   - Never export private keys
   - Always store public keys for verification
   - Implement key rotation policies

4. **Audit Logging**
   - Query logs regularly for anomalies
   - Monitor for replay attacks and signature failures
   - Keep audit logs for compliance (recommended: 1 year minimum)

5. **Wallet Integration**
   - Always verify wallet signatures before binding
   - Support wallet reconnection during login
   - Clear user experience for multi-wallet scenarios

---

## Configuration Reference

### Session Config

```javascript
{
  sessionTimeout: 5 * 60 * 1000,      // Session expiration time
  nonceTTL: 10 * 60 * 1000,           // Challenge expiration
  maxAttempts: 5,                      // Max failed attempts
  lockoutDuration: 15 * 60 * 1000      // Lockout time after max attempts
}
```

### Key Config

```javascript
{
  keyRotationPolicy: 90 * 24 * 60 * 60 * 1000,  // Key rotation period
  maxKeysPerDevice: 5                            // Max keys per device
}
```

### Wallet Config

```javascript
{
  walletVerificationTimeout: 5 * 60 * 1000,  // Wallet challenge timeout
  maxWalletsPerIdentity: 3                   // Max wallets per identity
}
```

### Audit Config

```javascript
{
  maxLogs: 100000,                      // Max in-memory logs
  logRetention: 90 * 24 * 60 * 60 * 1000  // Log retention period
}
```

---

## TypeScript Support

```typescript
import { 
  QSDIDAuthenticationSystem,
  AuthenticationStates,
  RegistrationFlow,
  LoginFlow,
  SecurityUtils
} from 'qsdid-identity';

const authSystem = new QSDIDAuthenticationSystem();
const flow: RegistrationFlow = authSystem.getRegistrationFlow();
```

---

## Integration Examples

### Express.js Integration

```javascript
import express from 'express';
import { QSDIDAuthenticationSystem } from 'qsdid-identity';

const app = express();
const authSystem = new QSDIDAuthenticationSystem();

// Registration endpoints
app.post('/auth/register/init', async (req, res) => {
  try {
    const session = await authSystem.getRegistrationFlow()
      .initializeRegistration(req.body);
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/register/lpp-approve', async (req, res) => {
  const { sessionId, token } = req.body;
  try {
    const result = await authSystem.getRegistrationFlow()
      .approveLocalProofOfPresence(sessionId, token);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ... more endpoints
```

### Error Logging Middleware

```javascript
app.use((error, req, res, next) => {
  const isSecurity = error.code?.includes('SIGNATURE')
    || error.code?.includes('REPLAY')
    || error.code?.includes('NONCE');

  if (isSecurity) {
    // Log security incident
    authSystem.auditLogger.logSecurityIncident(
      error.code,
      { 
        error: error.message,
        path: req.path,
        ip: req.ip 
      }
    );
  }

  res.status(400).json({ error: error.message });
});
```

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and flows
- [SECURITY_MODEL.md](./SECURITY_MODEL.md) - Security guarantees
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
