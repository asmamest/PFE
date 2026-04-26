# QSDID Storage v2.0 - QUICK START GUIDE

**⏱️ 5-minute setup** | **🟢 Production ready** | **✅ Tested**

---

## 🚀 Installation (3 steps)

```bash
# Step 1: Install dependencies
cd backend/decentralized-storage
npm install

# Step 2: Verify PQ module
npm run verify-pq
# Expected: "✅ PQ module ready"

# Step 3: Start service  
npm start
# Expected: "🟢 Server running on port 3000"
```

---

## 📝 Configuration (1 file)

Edit `.env`:
```bash
# Basic
STORAGE_MODE=zkp_ready
STRICT_VERIFICATION=true
NODE_ENV=production

# IPFS
IPFS_PRIMARY_URL=http://localhost:5001

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 🎯 First Request (Store Credential)

```bash
curl -X POST http://localhost:3000/api/v1/store \
  -H "Content-Type: application/json" \
  -d '{
    "claims": {
      "name": "Alice Smith",
      "degree": "Bachelor of Science"
    },
    "metadata": {
      "issuer": "MIT"
    },
    "did": "did:example:issuer123", 
    "privateKey": "ML-DSA-65-key-base64"
  }'
```

Response:
```json
{
  "success": true,
  "cid": "bafy...",
  "algorithm": "ML-DSA-65",
  "encryption": "none"
}
```

---

## 🔍 Retrieve Credential (With Verification)

```bash
curl http://localhost:3000/api/v1/retrieve/bafy...
```

Response:
```json
{
  "credential": {
    "claims": { "name": "Alice Smith" }
  },
  "verified": true,
  "verification": {
    "status": "VALID",
    "algorithm": "ML-DSA-65"
  }
}
```

---

## ✨ Key Features

| Feature | Status | Details |
|---------|--------|---------|
| **No Encryption** | ✅ | Credentials stored PLAIN |
| **ML-DSA-65 Mandatory** | ✅ | FIPS 204 post-quantum |
| **Verification** | ✅ | MANDATORY before access |
| **ZKP Compatible** | ✅ | Ready for blockchain |
| **Tamper Detection** | ✅ | Auto-reject modified creds |
| **Audit Logs** | ✅ | All operations tracked |

---

## 🧪 Run Tests

```bash
# All tests
npm test

# Integration tests only
npm run test:pq

# Example workflow
node examples/pq-workflow.js
```

---

## 📊 Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Response:
```json
{
  "status": "up",
  "version": "2.0.0-pq",
  "features": ["ML-DSA-65", "plaintext-storage", "zkp-ready"]
}
```

---

## 🔑 Security Guarantees

✅ **Post-Quantum Safe** - FIPS 204 standard  
✅ **Signature Mandatory** - Every credential signed  
✅ **Strict Verification** - No unsigned data accepted  
✅ **Tamper Protected** - Modified claims rejected  
✅ **Audit Trail** - All operations logged  
✅ **No Encryption** - Optimized for ZKP  

---

## 📚 Full Documentation

- `README-v2-PQ.md` - Complete documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical summary  
- `examples/pq-workflow.js` - Working examples
- `tests/pqIntegration.test.js` - Test suite

---

## 🆘 Troubleshooting

**Q: "WASM module not available"**  
A: Run `npm run verify-pq` and check qsdid-wasm is built

**Q: "Signature verification failed"**  
A: Verify issuer DID and private key are correct

**Q: "STRICT_VERIFICATION disabled in production"**  
A: Set `STRICT_VERIFICATION=true` in .env

**Q: Slow storage?**  
A: Check IPFS node is running: `curl http://localhost:5001/api/v0/id`

---

## 📞 Support

```bash
# Debug mode
DEBUG=qsdid:* npm start

# Check IPFS connection
curl http://localhost:5001/api/v0/id

# Verify Redis connection
redis-cli ping
```

---

## ✅ Production Checklist

- [ ] STRICT_VERIFICATION=true in .env
- [ ] NODE_ENV=production
- [ ] IPFS node running (Kubo v0.39+)
- [ ] Redis configured and secured
- [ ] Prometheus metrics enabled
- [ ] Audit logs configured
- [ ] Tests passing
- [ ] Docker container built

---

**🟢 Ready to Deploy!**

Next: `docker build -t qsdid-storage:2.0 .`

---

*QSDID Storage v2.0* | *Post-Quantum Cryptography* | *ML-DSA-65* | *April 2026*
