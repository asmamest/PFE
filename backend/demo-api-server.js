#!/usr/bin/env node

/**
 * QSDID Authentication System - Backend API Server
 * 
 * RESTful API for demonstrating PQC + LPP integration
 * Endpoints for hybrid key generation, encryption, TOTP, 3-factor auth
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'qsdid-frontend')));

// ============================================================================
// MOCK SERVICES (same as test)
// ============================================================================

class MockWasmModule {
  static encapsulationCache = new Map();

  static generate_hybrid_keys() {
    return {
      classic_public_key: crypto.randomBytes(65).toString('hex'),
      classic_private_key: crypto.randomBytes(32).toString('hex'),
      pq_public_key: crypto.randomBytes(1184).toString('hex'),
      pq_private_key: crypto.randomBytes(2400).toString('hex'),
    };
  }

  static generate_id() {
    return 'key_' + crypto.randomBytes(12).toString('hex');
  }

  static async kem_encapsulate(publicKey) {
    const sharedSecret = crypto.randomBytes(32);
    const kemCiphertext = crypto.randomBytes(1088).toString('hex');
    this.encapsulationCache.set(kemCiphertext, sharedSecret);
    return { kemCiphertext, sharedSecret };
  }

  static async kem_decapsulate(privateKey, kemCiphertext) {
    let sharedSecret = this.encapsulationCache.get(kemCiphertext);
    if (!sharedSecret) {
      sharedSecret = crypto.randomBytes(32);
      this.encapsulationCache.set(kemCiphertext, sharedSecret);
    }
    return { sharedSecret };
  }
}

class PQCService {
  constructor() {
    this.keys = new Map();
    this.nonces = new Set();
    this.replayWindow = 5 * 60 * 1000;
  }

  async generateHybridKeyPair(deviceId) {
    const keyData = MockWasmModule.generate_hybrid_keys();
    const keyId = MockWasmModule.generate_id();
    const keyRecord = {
      keyId,
      deviceId,
      createdAt: Date.now(),
      hybrid: keyData,
      usageCount: 0,
      lastUsed: null,
    };

    if (!this.keys.has(deviceId)) {
      this.keys.set(deviceId, []);
    }
    this.keys.get(deviceId).push(keyRecord);

    return {
      keyId,
      publicKey: {
        classic: keyData.classic_public_key.substring(0, 20) + '...',
        postQuantum: keyData.pq_public_key.substring(0, 20) + '...',
      },
      algorithms: {
        classic: 'ECDSA-P256 (NIST FIPS 186-4)',
        postQuantum: 'ML-KEM-768 (NIST PQC)',
      },
    };
  }

  async encryptDataPQC(deviceId, keyId, plaintext, context = {}) {
    let deviceKeys = this.keys.get(deviceId);
    if (!deviceKeys) throw new Error('Device not found');

    let keyRecord = deviceKeys.find(k => k.keyId === keyId);
    if (!keyRecord) throw new Error('Key not found');

    const kemResult = await MockWasmModule.kem_encapsulate(keyRecord.hybrid.pq_public_key);

    const salt = Buffer.from('QSDID-PQC-Encryption-v1', 'utf-8');
    const hmac1 = crypto.createHmac('sha256', salt);
    hmac1.update(kemResult.sharedSecret);
    const prk = hmac1.digest();

    const hmac2 = crypto.createHmac('sha256', prk);
    hmac2.update(Buffer.from('ENCRYPTION', 'utf-8'));
    const encryptionKey = hmac2.digest();

    const hmac3 = crypto.createHmac('sha256', prk);
    hmac3.update(Buffer.from('NONCE', 'utf-8'));
    const nonce = hmac3.digest().slice(0, 12);

    const nonceHex = nonce.toString('hex');
    if (this.nonces.has(nonceHex)) {
      throw new Error('Nonce reused');
    }
    this.nonces.add(nonceHex);

    const timestamp = Date.now();
    const timestampBuf = Buffer.allocUnsafe(8);
    timestampBuf.writeBigInt64BE(BigInt(timestamp));

    const sequence = keyRecord.usageCount;
    const sequenceBuf = Buffer.allocUnsafe(4);
    sequenceBuf.writeUInt32BE(sequence);

    const protectedPlaintext = Buffer.concat([
      timestampBuf,
      sequenceBuf,
      Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext),
    ]);

    const aad = Buffer.from(JSON.stringify({ deviceId, keyId, context }));

    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([
      cipher.update(protectedPlaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    keyRecord.usageCount++;
    keyRecord.lastUsed = timestamp;

    return {
      kemCiphertext: kemResult.kemCiphertext.substring(0, 32) + '...',
      ciphertext: ciphertext.toString('hex').substring(0, 32) + '...',
      authTag: authTag.toString('hex'),
      nonce: nonce.toString('hex'),
      timestamp,
      sequenceNumber: sequence,
      nonceLength: 96,
      algorithm: 'ML-KEM-768+AES-256-GCM',
      securityProperties: {
        quantum_safe: true,
        replay_protected: true,
        authenticated: true,
        context_bound: true,
      },
    };
  }

  async decryptDataPQC(deviceId, keyId, encryptedData) {
    const nonce = Buffer.from(encryptedData.nonce, 'hex');
    if (nonce.length !== 12) {
      throw new Error(`Invalid nonce length: ${nonce.length} bytes`);
    }

    return {
      plaintext: 'alice|session_token|verified',
      timestamp: encryptedData.timestamp,
      sequenceNumber: encryptedData.sequenceNumber,
      validations: {
        authTagVerified: true,
        nonceValid: true,
        replayProtected: true,
        contextBound: true,
        timestampValid: true,
      },
    };
  }
}

class LPPService {
  constructor() {
    this.authenticators = new Map();
    this.challenges = new Map();
    this.totpWindow = 30;
  }

  registerAuthenticator(userId, config) {
    const id = 'auth_' + crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');

    const auth = {
      id,
      userId,
      type: config.type || 'TOTP',
      secret,
      createdAt: Date.now(),
      name: config.name || 'Authenticator',
    };

    if (!this.authenticators.has(userId)) {
      this.authenticators.set(userId, []);
    }
    this.authenticators.get(userId).push(auth);

    return auth;
  }

  initiateLPPChallenge(userId, sessionId, context = {}) {
    const challengeId = 'challenge_' + crypto.randomBytes(8).toString('hex');
    const challenge = {
      challengeId,
      userId,
      sessionId,
      context,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000),
      attempts: 0,
    };

    this.challenges.set(challengeId, challenge);
    return challenge;
  }

  generateTOTPCode(secret) {
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = Buffer.allocUnsafe(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    hmac.update(counterBuffer);

    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;

    return {
      code: String(code).padStart(6, '0'),
      validUntil: ((counter + 1) * 30 * 1000),
      timeRemaining: ((counter + 1) * 30 * 1000) - Date.now(),
    };
  }

  approveLPPChallenge(userId, challengeId, approval) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'pending') throw new Error('Challenge already processed');

    if (approval.totpCode) {
      const auths = this.authenticators.get(userId) || [];
      let verified = false;

      for (const auth of auths) {
        const { code } = this.generateTOTPCode(auth.secret);
        if (code === approval.totpCode) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        throw new Error('TOTP code invalid');
      }
    }

    challenge.status = 'approved';
    challenge.approvedAt = Date.now();

    return {
      approved: true,
      confidence: 0.95,
      method: 'TOTP',
      deviceBound: true,
    };
  }

  getLPPChallengeStatus(userId, challengeId) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    return challenge;
  }
}

// ============================================================================
// INITIALIZE SERVICES
// ============================================================================

const pqcService = new PQCService();
const lppService = new LPPService();

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      pqc: 'operational',
      lpp: 'operational',
    },
    timestamp: new Date().toISOString(),
  });
});

// PQC Endpoints
app.post('/api/pqc/generate-keys', async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const keys = await pqcService.generateHybridKeyPair(deviceId);
    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pqc/encrypt', async (req, res) => {
  try {
    const { deviceId, keyId, plaintext, context } = req.body;
    if (!deviceId || !keyId || !plaintext) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const encrypted = await pqcService.encryptDataPQC(
      deviceId,
      keyId,
      plaintext,
      context || {}
    );

    res.json({
      success: true,
      data: encrypted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pqc/decrypt', async (req, res) => {
  try {
    const { deviceId, keyId, encryptedData } = req.body;
    if (!deviceId || !keyId || !encryptedData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const decrypted = await pqcService.decryptDataPQC(deviceId, keyId, encryptedData);
    res.json({ success: true, data: decrypted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LPP Endpoints
app.post('/api/lpp/register-authenticator', (req, res) => {
  try {
    const { userId, config } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const auth = lppService.registerAuthenticator(userId, config || {});
    res.json({
      success: true,
      data: {
        id: auth.id,
        type: auth.type,
        name: auth.name,
        secret: auth.secret.substring(0, 20) + '...',
        timestamp: new Date(auth.createdAt).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lpp/initiate-challenge', (req, res) => {
  try {
    const { userId, sessionId, context } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const challenge = lppService.initiateLPPChallenge(
      userId,
      sessionId || 'session_' + Date.now(),
      context || {}
    );

    res.json({
      success: true,
      data: {
        challengeId: challenge.challengeId,
        status: challenge.status,
        expiresIn: Math.round((challenge.expiresAt - Date.now()) / 1000),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lpp/generate-totp/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const auths = lppService.authenticators.get(userId);

    if (!auths || auths.length === 0) {
      return res.status(404).json({ error: 'No authenticators found' });
    }

    const auth = auths[0];
    const totp = lppService.generateTOTPCode(auth.secret);

    res.json({
      success: true,
      data: {
        code: totp.code,
        validFor: Math.round(totp.timeRemaining / 1000),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lpp/approve-challenge', (req, res) => {
  try {
    const { userId, challengeId, totpCode } = req.body;
    if (!userId || !challengeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const approval = lppService.approveLPPChallenge(userId, challengeId, {
      totpCode: totpCode || '',
    });

    res.json({
      success: true,
      data: {
        approved: approval.approved,
        confidence: approval.confidence,
        method: approval.method,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3-Factor Authentication Endpoint
app.post('/api/auth/authenticate', async (req, res) => {
  try {
    const { userId, deviceId, password, ipAddress } = req.body;

    // Step 1: Generate or get keys
    const keysResponse = await fetch('http://localhost:3000/api/pqc/generate-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    }).then(r => r.json());

    if (!keysResponse.success) throw new Error('Key generation failed');
    const keyId = keysResponse.data.keyId;

    // Step 2: Encrypt credentials
    const encryptResponse = await fetch('http://localhost:3000/api/pqc/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        keyId,
        plaintext: `${userId}|${password}|${Date.now()}`,
        context: { action: 'login', ipAddress },
      }),
    }).then(r => r.json());

    if (!encryptResponse.success) throw new Error('Encryption failed');

    // Step 3: Initiate LPP challenge
    const challengeResponse = await fetch('http://localhost:3000/api/lpp/initiate-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sessionId: 'session_' + Date.now(),
        context: { action: 'login', ipAddress },
      }),
    }).then(r => r.json());

    if (!challengeResponse.success) throw new Error('Challenge initiation failed');

    res.json({
      success: true,
      data: {
        keyId,
        encryptionData: encryptResponse.data,
        challenge: challengeResponse.data,
        steps_completed: ['encryption', 'challenge_initiated'],
        next_step: 'authenticator_approval',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  QSDID Authentication System - Backend API                    ║
║                                                                ║
║  Running on: http://localhost:${PORT}                            ║
║  Frontend: http://localhost:${PORT}/index.html                  ║
║                                                                ║
║  Services:                                                     ║
║  ✓ Post-Quantum Cryptography (PQC)                            ║
║  ✓ Local Proof of Presence (LPP)                              ║
║  ✓ 3-Factor Authentication                                    ║
║                                                                ║
║  API Endpoints:                                               ║
║  POST /api/pqc/generate-keys                                  ║
║  POST /api/pqc/encrypt                                        ║
║  POST /api/pqc/decrypt                                        ║
║  POST /api/lpp/register-authenticator                        ║
║  POST /api/lpp/initiate-challenge                            ║
║  GET  /api/lpp/generate-totp/:userId                         ║
║  POST /api/lpp/approve-challenge                             ║
║  POST /api/auth/authenticate                                 ║
╚════════════════════════════════════════════════════════════════╝
`);
});

export default app;
