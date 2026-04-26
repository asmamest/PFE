# QSDID Decentralized Storage Module

> Enterprise-grade off-chain credential storage using **IPFS / Kubo v0.39** with multi-node replication,  
> **AES-256-GCM encryption** (corrected IV+tag format), **ML-DSA-65 signature verification**,  
> **Circuit breaker resilience**, **Dead Letter Queue** with exponential backoff,  
> **Rate limiting**, **Redis persistence** (RDB + AOF), and **Prometheus + Grafana monitoring**.

**Status**: ✅ Production-Ready | **Tests**: 21 integration/unit tests | **Coverage**: All critical paths

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    storage-manager (Node.js + Express)                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ API Layer                                                       │   │
│  │  POST   /api/v1/store          [Rate Limiter: 100/15m]        │   │
│  │  GET    /api/v1/retrieve/:cid                                 │   │
│  │  GET    /api/v1/credentials    [Pagination: Redis Sorted Set] │   │
│  │  GET    /api/v1/dlq-status                                    │   │
│  │  GET    /api/v1/circuit-breaker                               │   │
│  │  GET    /health, /health/ipfs                                 │   │
│  │  GET    :9091/metrics          [Prometheus endpoint]          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ Store Credential │  │ Encryption+Sign  │  │ IPFS Pin + Index │      │
│  │ (with CB check)  │  │ (GCM tag @ END)  │  │ (Replication 3N) │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│           ↓                     ↓                     ↓                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Resilience Layer                                                │   │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────┐  │   │
│  │  │ Circuit Breaker     │  │ Dead Letter Queue (DLQ)        │  │   │
│  │  │ CLOSED→OPEN→HALF    │  │ Retry with backoff: 1s,5s,30s │  │   │
│  │  │ (3 failures trigger)│  │ Final failures → DLQ for audit │  │   │
│  │  └─────────────────────┘  └─────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Background Workers                                              │   │
│  │  • Provide Sweep Worker (Kubo DHT announces)                   │   │
│  │  • Retry Worker (5s intervals)                                 │   │
│  │  • Replication Worker (background, non-blocking)               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
          │                        │                        │
   ┌──────▼──────┐        ┌────────▼────────┐      ┌────────▼────────┐
   │ IPFS Kubo   │        │ Redis 7.x +     │      │ Prometheus +    │
   │ (3 nodes)   │        │ Persistence     │      │ Grafana         │
   │ Replication │        │ (RDB + AOF)     │      │ Monitoring      │
   └─────────────┘        └─────────────────┘      └─────────────────┘
```

Each credential is stored as an IPFS directory:
```
<CIDv1>/
  ├── claims.json.enc    – AES-256-GCM encrypted claims
  ├── image.enc          – AES-256-GCM encrypted image (optional)
  ├── signature.ml-dsa   – ML-DSA-65 detached signature
  └── metadata.json      – plaintext metadata (type, issuer, dates, DID, UUID…)
```

Only the **root CID** is stored on-chain.

---

## Quick Start

### 1. Clone & install

```bash
cd backend/decentralized-storage

# Install dependencies
npm install
npm install express-rate-limit  # NEW: Rate limiting middleware

# Copy example env
cp .env.example .env

# CRITICAL: Set MASTER_ENCRYPTION_KEY to a secure 64-char hex value
# Option A: OpenSSL
openssl rand -hex 32

# Option B: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Environment Configuration

Key variables in `.env`:

```bash
# Service
PORT=3500
NODE_ENV=production
LOG_LEVEL=info

# ENCRYPTION (MUST BE SET!)
MASTER_ENCRYPTION_KEY=<64-char-hex-random>

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# IPFS Replication (3 nodes)
IPFS_API_URL=http://localhost:5001
IPFS_NODE_1=http://localhost:5001
IPFS_NODE_2=http://node2:5001
IPFS_NODE_3=http://node3:5001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes

# Storage Path (for disk space check)
STORAGE_PATH=/data/ipfs

# Prometheus Metrics
METRICS_ENABLED=true
PROMETHEUS_PORT=9091

# Blockchain (optional)
BLOCKCHAIN_ENABLE_ORACLE=false
BLOCKCHAIN_RPC_URL=http://localhost:8545
```

### 3. Run with Docker Compose (recommended)

```bash
# Single node (dev)
docker compose up ipfs-node-1 redis storage-manager

# Full 3-node cluster + monitoring + persistence
docker compose up

# View logs
docker compose logs -f storage-manager
```

### 4. Run locally (requires Kubo + Redis)

```bash
# Terminal 1: Start Kubo daemon
ipfs daemon --enable-gc &

# Terminal 2: Start Redis
redis-server

# Terminal 3: Start storage manager
npm run dev
```

---

## Configuring Kubo v0.39 for Provide Sweep

Run `scripts/init-kubo.sh` once after `ipfs init` to apply the optimised settings:

```bash
bash scripts/init-kubo.sh
```

Key settings applied:

| Setting | Value | Reason |
|---|---|---|
| `Datastore.StorageMax` | 500 GB (configurable) | Prevent disk overflow |
| `Routing.Type` | `dht` | Public DHT — any Kubo node can find CIDs |
| `Reprovider.Interval` | `"0"` (disabled) | We drive sweeps manually via the worker |
| `Reprovider.Strategy` | `all` | Announce all pinned CIDs during a sweep |
| `Experimental.ProvideQueue.Workers` | `8` | Parallel DHT announce goroutines |

**Provide Sweep** (new in Kubo v0.39) groups all DHT announcements destined for the same peers into a single round trip, reducing DHT lookups by **~97%** compared to older versions.

### Monitor provides

```bash
# CLI (Kubo v0.39+)
ipfs provide stat

# Via the storage-manager health endpoint
curl http://localhost:3500/health/provide
```

---

## New Features (Enterprise-Grade)

### 🔌 Circuit Breaker

**Resilience pattern** preventing cascade failures:
- States: CLOSED (healthy) → OPEN (too many failures) → HALF_OPEN (testing recovery)
- Triggers: 3 consecutive failures (configurable)
- Auto-recovery: Transitions to HALF_OPEN after 30s timeout
- Monitor: `GET /api/v1/circuit-breaker`

### 📮 Dead Letter Queue (DLQ)

**Reliable processing** with exponential backoff:
- Failed CIDs automatically retry with delays: 1s → 5s → 30s
- After 3 retries, moves to DLQ for manual review
- Retry worker checks every 5 seconds
- Monitor: `GET /api/v1/dlq-status`, `GET /api/v1/dlq-entries`

### 🚀 Multi-Node Replication

**Automatic redundancy** across 3 IPFS nodes:
- Background execution (non-blocking to store request)
- Individual retry per node (2 attempts)
- Replication factor tracked (metric: `ipfs_replication_factor`)
- Timeout: 30s per node

### 🎫 Rate Limiting

**API protection** against abuse:
- 100 requests per 15 minutes (configurable)
- Key: DID from body (if present) or client IP
- Applied to: `POST /api/v1/store`
- Response: 429 Too Many Requests with `Retry-After` header

### 📋 Pagination

**Efficient credential listing** via Redis:
- Endpoint: `GET /api/v1/credentials?did={did}&page=1&limit=20`
- Sorted by timestamp (most recent first)
- 1-year auto-expiry
- Supports up to 100 items per page

### 🔐 Enhanced Encryption

**Corrected AES-256-GCM** format validation:
- Structure: `[salt(32) | iv(12) | ciphertext(N) | tag(16)]`
- **GCM tag at END** ensures entire message authenticity
- Tag verification on every decrypt
- Metrics: `credential_decryption_errors_total`

### 💾 Redis Persistence

**Data durability** with RDB + AOF:
- RDB snapshots every 60s
- AOF (Append-Only File) every second
- Automatic recovery on restart
- Configuration: `redis.conf`

---

## API Reference

### Authentication & Rate Limiting

**Rate Limiting** (on POST /api/v1/store):
- **100 requests per 15 minutes** (configurable)
- **Key**: DID from request body, fallback to IP
- **Response**: 429 Too Many Requests with `Retry-After` header

### Endpoints

#### `POST /api/v1/store` ⚡ **Rate Limited**

Store a credential on IPFS with automatic replication to 3 nodes.

Request body (JSON):
```json
{
  "claims": {...},           // Object with credential claims
  "metadata": {...},         // Object with did, issuer, dates, etc.
  "signature": "base64...",  // ML-DSA-65 signature
  "image": "base64..."       // Optional: base64-encoded image
}
```

Response (201 Created):
```json
{
  "success": true,
  "credentialId": "uuid-123",
  "rootCid": "bafy..."
}
```

**Behind the scenes**:
1. ✅ Encrypts claims with AES-256-GCM (IV + CT + **tag at END**)
2. ✅ Stores on IPFS (main node)
3. ✅ Enqueues CID for DHT provide sweep
4. ✅ **Indexes for pagination** (Redis Sorted Set by DID)
5. ✅ **Starts background replication** to 3 IPFS nodes (non-blocking)

#### `GET /api/v1/retrieve/:rootCid`

Retrieve and decrypt a credential.

Query parameters:
- `issuerPubKey` (hex) - Required for ML-DSA-65 verification

Response (200 OK):
```json
{
  "success": true,
  "rootCid": "bafy...",
  "claims": {...},
  "metadata": {...},
  "image": "base64...",
  "signatureValid": true
}
```

#### `GET /api/v1/credentials`

List credentials for a DID with **pagination**.

Query parameters:
- `did` (string) - Required: DID holder
- `page` (number) - Default: 1
- `limit` (number) - Default: 20, max: 100

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "credentials": [
      {
        "cid": "bafy...",
        "indexedAt": "2026-04-13T10:30:00Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  },
  "_links": {
    "self": "?did=did:example:123&page=1&limit=20",
    "next": "?did=did:example:123&page=2&limit=20"
  }
}
```

#### `GET /health`

Comprehensive health check with **global timeout** (10s).

Response (200 OK or 503 if critical):
```json
{
  "status": "ok",  // "ok" | "degraded" | "critical"
  "timestamp": "2026-04-13T10:30:00Z",
  "checks": {
    "ipfs": {
      "node0": {"ok": true, "version": "0.39.0"},
      "node1": {"ok": true, "version": "0.39.0"},
      "node2": {"ok": false, "error": "Connection timeout"},
      "summary": {"ok": 2, "total": 3, "allHealthy": false}
    },
    "redis": {"ok": true, "latencyMs": 2},
    "disk": {
      "ok": true,
      "usedPercent": 0.45,
      "usedGB": 225,
      "freeGB": 275
    },
    "oracle": {"ok": true, "latencyMs": 150},
    "queues": {
      "mainQueue": 45,
      "retryQueue": 3,
      "dlq": 0
    }
  },
  "circuitBreaker": {
    "name": "redis",
    "state": "CLOSED",
    "stateCode": 0,
    "failureCount": 0
  }
}
```

#### `GET /health/ipfs`

Detailed IPFS node status with **latency** per node.

Response:
```json
{
  "ok": true,
  "nodes": [
    {"url": "http://node1:5001", "ok": true, "version": "0.39.0", "latencyMs": 15},
    {"url": "http://node2:5001", "ok": true, "version": "0.39.0", "latencyMs": 18},
    {"url": "http://node3:5001", "ok": false, "error": "Connection refused", "latencyMs": 5000}
  ],
  "avgLatencyMs": 16,
  "healthyCount": 2,
  "totalCount": 3
}
```

#### `GET /health/provide`

Kubo provide stats (DHT announces).

#### `GET /api/v1/dlq-status` 📊

Dead Letter Queue monitoring.

Response:
```json
{
  "queues": {
    "main": 45,        // Main processing queue
    "retry": 3,        // Waiting for retry (scheduled)
    "dlq": 0           // Final failures after 3 retries
  },
  "circuitBreaker": {
    "state": "CLOSED",
    "stateCode": 0,
    "failureCount": 0
  },
  "timestamp": "2026-04-13T10:30:00Z"
}
```

#### `GET /api/v1/dlq-entries` 🔍

Inspect failed CIDs in DLQ (for debugging).

Query parameters:
- `limit` (number) - Default: 100, max: 1000

Response:
```json
{
  "count": 5,
  "entries": [
    {
      "cid": "bafy...",
      "failedAt": "2026-04-13T10:25:00Z",
      "retryCount": 3
    }
  ],
  "timestamp": "2026-04-13T10:30:00Z"
}
```

#### `GET /api/v1/circuit-breaker` 🔌

Circuit breaker status.

Response:
```json
{
  "name": "redis",
  "state": "CLOSED",        // CLOSED | OPEN | HALF_OPEN
  "stateCode": 0,           // 0 | 1 | 2
  "failureCount": 0,
  "successCount": 0,
  "lastFailureTime": null,
  "nextAttemptTime": null,
  "stateName": "CLOSED",
  "timestamp": "2026-04-13T10:30:00Z"
}
```

#### `GET :9091/metrics` 📈

Prometheus metrics endpoint (separate port).

Example queries:
```promql
redis_queue_length
redis_dlq_length
circuit_breaker_state{service="redis"}
ml_dsa_verification_failures_total
credential_decryption_errors_total
ipfs_replication_factor
ipfs_pin_duration_seconds_bucket
```

### Old Endpoints (Maintained)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/retrieve/:rootCid` | GET | Retrieve credential |

---

## Prometheus Metrics (11 Total)

### Store/Retrieve Operations

| Metric | Type | Description |
|---|---|---|
| `ipfs_store_total` | Counter | Total credentials stored |
| `ipfs_store_duration_seconds` | Histogram | Store operation latency (buckets: 50ms to 10s) |
| `ipfs_retrieve_total` | Counter | Total credentials retrieved |
| `ipfs_retrieve_duration_seconds` | Histogram | Retrieve operation latency |

### DHT Provides & Queue

| Metric | Type | Description |
|---|---|---|
| `ipfs_provide_total_cids` | Gauge | CIDs announced to DHT |
| `ipfs_provide_last_sweep_duration_seconds` | Gauge | Last sweep duration |
| `ipfs_provide_errors_total` | Counter | DHT provide errors |
| `redis_queue_length` | Gauge | Main processing queue size |
| `redis_retry_queue_length` | Gauge | Retry queue size (waiting for backoff) |
| `redis_dlq_length` | Gauge | Dead Letter Queue size (final failures) |

### Signature & Encryption

| Metric | Type | Description |
|---|---|---|
| `ml_dsa_verification_failures_total` | Counter | Invalid/failed signature verifications |
| `ml_dsa_verification_successes_total` | Counter | Valid signatures verified |
| `credential_decryption_errors_total` | Counter | Decryption failures (invalid GCM tag, etc.) |
| `credential_decryption_success_total` | Counter | Successful decryptions |

### Replication & Circuit Breaker

| Metric | Type | Labels | Description |
|---|---|---|---|
| `ipfs_replication_factor` | Gauge | - | Average copies per CID (0.0 to 1.0) |
| `ipfs_pin_duration_seconds` | Histogram | - | Pin operation duration per node |
| `circuit_breaker_state` | Gauge | `service="redis"` | 0=CLOSED, 1=OPEN, 2=HALF_OPEN |
| `circuit_breaker_failure_count` | Gauge | `service="redis"` | Number of consecutive failures |

---

## Running Tests

**21 total tests** (integration + unit) covering all critical flows:

```bash
# Install test dependencies (if not already done)
npm install --save-dev jest @jest/globals

# Run all tests
npm test

# Run specific suites
npm run test:unit
npm run test:integration

# With coverage
npm test -- --coverage
```

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| `ipfsFailure.test.js` | 2 | Node failures + replication factor |
| `redisFailure.test.js` | 3 | Connection loss + resync + draining |
| `tamperedCredentials.test.js` | 4 | Signature verification + tampering |
| `circuitBreaker.test.js` | 7 | All 3 states + transitions + reset |
| `rateLimiting.test.js` | 5 | Rate limit enforcement + window reset |

**Expected output** (all passing):
```
PASS tests/integration/ipfsFailure.test.js (2 tests)
PASS tests/integration/redisFailure.test.js (3 tests)
PASS tests/integration/tamperedCredentials.test.js (4 tests)
PASS tests/unit/circuitBreaker.test.js (7 tests)
PASS tests/integration/rateLimiting.test.js (5 tests)

Tests: 21 passed, 21 total
```

### Load Test (Optional)

```bash
# 50,000 credentials concurrently
LOAD_COUNT=50000 CONCURRENCY=20 node tests/load/load-test.js
```

---

## Monitoring & Observability

### Health Endpoints

```bash
# Full health check (all services)
curl http://localhost:3500/health

# IPFS nodes detail
curl http://localhost:3500/health/ipfs

# DLQ monitoring
curl http://localhost:3500/api/v1/dlq-status

# Circuit breaker state
curl http://localhost:3500/api/v1/circuit-breaker
```

### Prometheus Queries

Access: **http://localhost:9090**

Popular queries:
```promql
# Queue depth
redis_queue_length

# DLQ size (growing = problems)
redis_dlq_length

# Replication factor (should be close to 1.0)
ipfs_replication_factor

# Decryption errors rate
rate(credential_decryption_errors_total[5m])

# Circuit breaker state (0=healthy)
circuit_breaker_state{service="redis"}

# Pin operation duration (p95)
histogram_quantile(0.95, ipfs_pin_duration_seconds_bucket)
```

### Grafana Dashboard

Access: **http://localhost:3000** (admin / admin)

1. Add Prometheus datasource: `http://prometheus:9090`
2. Import or create dashboard with above metrics
3. Set alerts for:
   - `redis_dlq_length > 100` (DLQ growing)
   - `circuit_breaker_state == 1` (Circuit open)
   - `ipfs_replication_factor < 0.9` (Low replication)

---

## Example Scripts

```bash
# Store a credential
node examples/store-credential.js

# Retrieve a credential
node examples/retrieve-credential.js bafy...
```

---

## Deploying a 3-Node Cluster

```bash
docker compose up ipfs-node-1 ipfs-node-2 ipfs-node-3
```

Peer the nodes manually (or use `ipfs-cluster-service` with CRDT consensus):

```bash
# Get node-1 peer address
docker exec qsdid-ipfs-1 ipfs id -f="<addrs>"

# Connect node-2 to node-1
docker exec qsdid-ipfs-2 ipfs swarm connect /ip4/172.x.x.x/tcp/4001/p2p/<PeerID>
```

With `ipfs-cluster-service` (CRDT mode), each credential is automatically replicated on ≥ 2 nodes.

---

## Security Notes

- **Encryption keys are never stored on IPFS.** Each file is encrypted with a key derived from `MASTER_ENCRYPTION_KEY` + `credentialId` via HKDF-SHA256.
- Store `MASTER_ENCRYPTION_KEY` in a secrets manager (Vault, AWS Secrets Manager) in production.
- All CIDs are **CIDv1 (base32)** for modern DHT compatibility.
- ML-DSA-65 (FIPS 204) provides post-quantum signature security.

---

## RISC-V Compatibility

Kubo v0.39 provides official RISC-V (riscv64) pre-compiled binaries. In the Dockerfile, set:

```dockerfile
ARG TARGETARCH=riscv64
```

or use Docker Buildx multi-platform builds:

```bash
docker buildx build --platform linux/riscv64 -t qsdid-storage .
```

---

## Documentation & Deployment

### Complete Guides

- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - Detailed feature descriptions (9 functionalities)
- **[PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md)** - Deployment verification steps
- **[DOCKER_COMPOSE_UPDATES.md](DOCKER_COMPOSE_UPDATES.md)** - Docker Compose configuration with persistence
- **[FILES_SUMMARY.md](FILES_SUMMARY.md)** - Complete file listing and changes summary

### Key Configuration Files

- **[redis.conf](redis.conf)** - Redis persistence settings (RDB + AOF)
- **.env.example** - Environment variables template

---

## Status

| Aspect | Status |
|--------|--------|
| **Production Ready** | ✅ YES |
| **Tests** | ✅ 21/21 passing |
| **Documentation** | ✅ Complete |
| **Monitoring** | ✅ Prometheus + Grafana |
| **Resilience** | ✅ Circuit Breaker + DLQ |
| **Security** | ✅ AES-256-GCM + ML-DSA-65 |
| **Performance** | ✅ Multi-node replication + caching |
| **Data Persistence** | ✅ RDB + AOF |

---

## Quick Reference

```bash
# Install & setup
npm install express-rate-limit
openssl rand -hex 32  # Generate MASTER_ENCRYPTION_KEY

# Docker deployment (all-in-one)
docker-compose up -d

# Verification
curl http://localhost:3500/health
curl http://localhost:3500/api/v1/dlq-status
curl http://localhost:9091/metrics

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)

# Run tests
npm test  # All 21 tests
```

---
