# PRE-PRODUCTION CHECKLIST

## ✅ Code Implementation

- [x] Cryptography - AES-256-GCM correction
- [x] Redis circuit breaker
- [x] Dead Letter Queue (DLQ) with backoff
- [x] Comprehensive health checks
- [x] Prometheus metrics
- [x] Rate limiting middleware
- [x] IPFS multi-node replication
- [x] Credential pagination
- [x] Jest test suites

---

## 📦 Dependencies Installation

```bash
cd backend/decentralized-storage

# Install new dependencies
npm install express-rate-limit

# Verify all packages
npm list

# Expected packages:
# ✓ express-rate-limit
# ✓ prom-client
# ✓ ioredis
# ✓ node-cron
# ✓ node-fetch@2
# ✓ winston
# ✓ uuid
# ✓ dilithium-crystals (for ML-DSA-65)
# ✓ ethers (for blockchain)
```

---

## 🔐 Environment Setup

### 1. Generate Master Encryption Key (CRITICAL)

```bash
# Use a secure random 32-byte hex key
# Option A: OpenSSL
openssl rand -hex 32
# Example output: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6

# Option B: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in .env
MASTER_ENCRYPTION_KEY=<your-64-char-hex-string>
```

### 2. Configure Redis

```bash
# Copy redis.conf to project root
cp redis.conf redis.conf

# Verify it has:
# - save 60 1000 (RDB)
# - appendonly yes (AOF)
# - appendfsync everysec
```

### 3. Environment Variables

Create `.env` file:

```bash
# Service
PORT=3500
NODE_ENV=production
LOG_LEVEL=info

# Encryption (MUST BE SET!)
MASTER_ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=optional_secure_password

# IPFS Replication
IPFS_API_URL=http://ipfs-node-1:5001
IPFS_NODE_1=http://ipfs-node-1:5001
IPFS_NODE_2=http://ipfs-node-2:5001
IPFS_NODE_3=http://ipfs-node-3:5001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Storage
STORAGE_PATH=/data/ipfs

# Metrics
METRICS_ENABLED=true
PROMETHEUS_PORT=9091

# Blockchain (optional)
BLOCKCHAIN_ENABLE_ORACLE=false
BLOCKCHAIN_RPC_URL=http://localhost:8545
BLOCKCHAIN_ORACLE_ADDRESS=0x...
BLOCKCHAIN_ORACLE_PRIVATE_KEY=0x...

# Logging
LOG_LEVEL=info
```

---

## 🧪 Testing

### Run Complete Test Suite

```bash
# Install test dependencies
npm install --save-dev jest @jest/globals

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Test coverage
npm test -- --coverage

# Expected: All 5 test suites passing
# - ipfsFailure.test.js ✓
# - redisFailure.test.js ✓
# - tamperedCredentials.test.js ✓
# - circuitBreaker.test.js ✓
# - rateLimiting.test.js ✓
```

### Manual Testing

```bash
# 1. Health Check
curl http://localhost:3500/health
# Expected: status "ok" or "degraded", not "critical"

# 2. Store Credential
curl -X POST http://localhost:3500/api/v1/store \
  -H "Content-Type: application/json" \
  -d '{
    "claims": {"name": "test"},
    "metadata": {"did": "did:example:123"},
    "signature": "aabbccdd...",
    "image": "base64_string_optional"
  }'
# Expected: 201 {rootCid, credentialId}

# 3. List Credentials
curl "http://localhost:3500/api/v1/credentials?did=did:example:123&page=1&limit=20"
# Expected: 200 {credentials: [], page, total, hasMore}

# 4. Rate Limiting (send 101 requests)
for i in {1..101}; do
  curl -X POST http://localhost:3500/api/v1/store \
    -H "Content-Type: application/json" \
    -d '{"claims":{},"metadata":{},"signature":""}'
done
# Expected: Request 101 returns 429 Too Many Requests

# 5. Metrics
curl http://localhost:9091/metrics | grep qsdid
# Expected: Multiple metric lines (redis_queue_length, circuit_breaker_state, etc.)

# 6. Circuit Breaker Status
curl http://localhost:3500/api/v1/circuit-breaker
# Expected: {state: "CLOSED", stateCode: 0, failureCount: 0}

# 7. DLQ Status
curl http://localhost:3500/api/v1/dlq-status
# Expected: {queues: {main, retry, dlq}, circuitBreaker}
```

---

## 🚀 Docker Deployment

### 1. Build Images

```bash
# Build storage-manager image
docker build -t qsdid-storage-manager:latest .

# Verify image
docker images | grep qsdid
```

### 2. Start Services with Docker Compose

```bash
# Start all services (Redis + Storage Manager + IPFS nodes + Prometheus + Grafana)
docker-compose up -d

# Verify containers running
docker-compose ps

# Expected output:
# qsdid-redis                    Up
# qsdid-storage-manager          Up
# qsdid-ipfs-node-1              Up
# qsdid-ipfs-node-2              Up
# qsdid-ipfs-node-3              Up
# qsdid-prometheus               Up
# qsdid-grafana                  Up
```

### 3. Verify Persistence

```bash
# Check Redis persistence
docker exec qsdid-redis redis-cli BGSAVE
# Expected: Background save started

# Verify RDB file created
docker exec qsdid-redis ls -la /data/
# Expected: dump.rdb exists

# Verify AOF enabled
docker exec qsdid-redis redis-cli CONFIG GET appendonly
# Expected: "appendonly" "yes"
```

### 4. Monitor Logs

```bash
# View service logs
docker-compose logs -f storage-manager

# Watch for:
# ✓ "[redis] Connected"
# ✓ "[retryWorker] Started"
# ✓ "[metrics] Prometheus endpoint listening"
# ✗ "[CircuitBreaker:redis] ✗ OPEN" (indicates issue)
```

---

## 📊 Monitoring Setup

### 1. Access Prometheus

Visit: `http://localhost:9090`

**Add queries to explore**:
```promql
# Main queue size
redis_queue_length

# DLQ size
redis_dlq_length

# Circuit breaker state
circuit_breaker_state{service="redis"}

# Pin duration
rate(ipfs_pin_duration_seconds_bucket[5m])

# Decryption errors
rate(credential_decryption_errors_total[5m])
```

### 2. Configure Grafana Dashboard

Visit: `http://localhost:3000` (admin/admin)

1. Add Prometheus datasource: `http://prometheus:9090`
2. Import dashboard or create new with queries above
3. Set refresh interval: 30s

### 3. Set Alerts (Optional)

```yaml
# In monitoring/prometheus.yml, add:
alert_rules:
  - alert: CircuitBreakerOpen
    expr: circuit_breaker_state{service="redis"} == 1
    for: 1m
    annotations:
      summary: "Redis circuit breaker OPEN"
  
  - alert: DLQGrowing
    expr: redis_dlq_length > 100
    for: 5m
    annotations:
      summary: "DLQ size exceeding 100 items"
  
  - alert: HighDecryptionErrors
    expr: rate(credential_decryption_errors_total[5m]) > 0.1
    for: 2m
    annotations:
      summary: "Decryption error rate high"
```

---

## 🔄 Backup & Recovery

### 1. Redis Data Backup

```bash
# Manual RDB snapshot backup
docker exec qsdid-redis redis-cli SAVE
docker cp qsdid-redis:/data/dump.rdb ./backups/redis-dump-$(date +%Y%m%d).rdb

# AOF backup (continuous)
docker cp qsdid-redis:/data/appendonly.aof ./backups/appendonly-$(date +%Y%m%d).aof

# Backup volume
docker run --rm -v qsdid-storage-manager_redis-data:/data \
  -v ./backups:/backup \
  alpine tar czf /backup/redis-data-$(date +%Y%m%d).tar.gz -C /data .
```

### 2. Redis Recovery

```bash
# Restore from RDB
docker exec qsdid-redis redis-cli BGREWRITEAOF
docker restart qsdid-redis

# Verify data
docker exec qsdid-redis redis-cli DBSIZE
```

---

## 🔒 Security Checklist

- [ ] MASTER_ENCRYPTION_KEY is 64 random hex chars (NEVER debug/log it)
- [ ] Redis password set (REDIS_PASSWORD in .env)
- [ ] Rate limiting enabled (100 requests/15m)
- [ ] Circuit breaker tuning reviewed (failureThreshold, timeout)
- [ ] IPFS nodes routable from storage manager container
- [ ] Prometheus & Grafana on private network (not exposed to internet)
- [ ] Log forwarder configured (not storing sensitive data)
- [ ] TLS/SSL certificates installed for production
- [ ] Firewall rules restrict port access (3500, 9091, 6379)
- [ ] Blockchain Oracle keys secured (if enabled)

---

## 🚨 Troubleshooting

### Issue: Redis Circuit Breaker OPEN

```bash
# Check Redis connection
docker exec qsdid-redis redis-cli ping
# Expected: PONG

# Restart Redis
docker-compose restart redis

# Reset circuit breaker (in logs, wait for HALF_OPEN transition)
# After timeout (default 30s), should auto-recover
```

### Issue: High DLQ Size

```bash
# Check DLQ entries
curl http://localhost:3500/api/v1/dlq-entries?limit=10
# Expected: Inspect failed CIDs

# Verify retry worker is running
docker-compose logs storage-manager | grep "retryWorker"
# Expected: "[retryWorker] Started"
```

### Issue: Rate Limit False Positives

```bash
# Check rate limiter config
grep RATE_LIMIT .env
# Verify: RATE_LIMIT_MAX=100, RATE_LIMIT_WINDOW_MS=900000

# Test with explicit DID
curl -X POST http://localhost:3500/api/v1/store \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"did":"test-did-123"},...}'
```

### Issue: Replication Failures

```bash
# Check IPFS node replication status
curl http://localhost:3500/api/v1/dlq-status
# Look for: replicationFactor < 1.0

# Verify IPFS nodes accessible
for node in {1,2,3}; do
  curl http://ipfs-node-$node:5001/api/v0/version
done
# Expected: All return version info
```

---

## 📋 Post-Deployment Verification

**Within 1 hour**:
- [ ] All containers running (`docker-compose ps`)
- [ ] No error logs (`docker-compose logs | grep ERROR`)
- [ ] Health check passing (`curl /health` → 200 ok)
- [ ] Metrics being collected (`curl :9091/metrics | wc -l` > 100)
- [ ] Redis persisting data (check `/data/dump.rdb`)

**Within 24 hours**:
- [ ] Circuit breaker tested (simulate Redis failure)
- [ ] DLQ tested (verify failed CIDs retried)
- [ ] Rate limiting active (verify 429 on overuse)
- [ ] Replicated CIDs confirmed on 2+ IPFS nodes
- [ ] No memory leaks (check container memory usage stable)

**Weekly reviews**:
- [ ] DLQ size < 10 items
- [ ] Circuit breaker CLOSED 99% of time
- [ ] Replication factor > 0.9 (at least 3/3 nodes healthy)
- [ ] Backup volumes collected

---

**🎉 Ready for Production!**
