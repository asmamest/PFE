// backend/routes/totp.js
const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const router = express.Router();

// Stockage temporaire (à remplacer par une base de données)
const totpSecrets = new Map();

// POST /api/totp/setup – Générer le QR code pour l'onboarding
router.post('/setup', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const secret = speakeasy.generateSecret({ length: 20 });
  const otpauthUrl = secret.otpauth_url;

  totpSecrets.set(userId, secret.base32);

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({ qrCode: qrDataUrl });
});

// POST /api/totp/verify – Vérifier le code TOTP lors du login
router.post('/verify', (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });

  const secret = totpSecrets.get(userId);
  if (!secret) return res.status(404).json({ error: 'TOTP not set up for this user' });

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (verified) res.json({ success: true });
  else res.status(401).json({ error: 'Invalid TOTP code' });
});

module.exports = router;
