# QSDID Decentralized Storage - Complete Execution Guide

**Version:** 2.0  
**Created:** April 16, 2026  
**Status:** ✅ Production Ready  

---

## 📋 Quick Navigation

- [Overview](#overview)
- [Getting Started (3 steps)](#getting-started)
- [Scripts & Modes](#scripts--modes)
- [Command Reference](#command-reference)
- [Workflows](#workflows)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers **three execution scripts**:

| Script | Platform | Purpose |
|--------|----------|---------|
| `run-all.ps1` | Windows (PowerShell) | Complete workflow automation |
| `run-all.sh` | Linux/macOS (Bash) | Complete workflow automation |
| `Makefile` | All platforms | Simplified command wrapper |

All three scripts execute the **same 8-step workflow**:

1. ✅ Verify dependencies (Node.js, npm, Docker)
2. 📦 Setup & install (npm packages, WASM module)
3. 🐳 Start Docker services (IPFS, Redis)
4. 🧪 Run all tests (unit, integration, PQ, load)
5. 🚀 Start API server
6. 🎮 Demonstrate workflows (store, retrieve, verify, export-zkp)
7. 📊 Run load tests
8. 📄 Generate execution report

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0 → [Download](https://nodejs.org)
- **Docker** & **Docker Compose** → [Download](https://docker.com)
- **PowerShell 5.1+** (Windows) OR **Bash** (Linux/macOS)

### Step 1: Install Dependencies

```powershell
# Windows
npm install

# OR Linux/macOS
npm install
```

### Step 2: Choose Your Method

#### **Option A: PowerShell (Windows)**

```powershell
# Make script executable
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Run full workflow
.\run-all.ps1

# OR specific mode
.\run-all.ps1 -Mode setup
.\run-all.ps1 -Mode test
.\run-all.ps1 -Mode run
.\run-all.ps1 -Mode demo
```

#### **Option B: Bash (Linux/macOS)**

```bash
# Make script executable
chmod +x run-all.sh

# Run full workflow
./run-all.sh

# OR specific mode
./run-all.sh setup
./run-all.sh test
./run-all.sh run
./run-all.sh demo
```

#### **Option C: Makefile (All Platforms)**

```bash
# View all commands
make help

# Run commands
make setup
make test
make run
make demo
make full
```

### Step 3: Done! 🎉

Your server is running on **http://localhost:3000**

---

## Scripts & Modes

### Available Modes

| Mode | What It Does | Useful For |
|------|-------------|-----------|
| **full** | Setup + Test + Docker (entire pipeline) | First-time complete setup |
| **setup** | Install & configure (no testing) | Quick environment prep |
| **test** | Run all tests + load tests | Validation before deployment |
| **run** | Start API server | Development/debugging |
| **demo** | Execute workflow demonstrations | See features in action |
| **docker** | Start IPFS + Redis only | Manual testing |
| **stop** | Stop all Docker services | Cleanup |

### Examples

```powershell
# PowerShell - Full workflow
.\run-all.ps1 -Mode full

# PowerShell - Just run server
.\run-all.ps1 -Mode run

# PowerShell - Test everything
.\run-all.ps1 -Mode test

# PowerShell - See verbose output
.\run-all.ps1 -Mode setup -Verbose
```

```bash
# Bash - Full workflow
./run-all.sh full

# Bash - Just start tests
./run-all.sh test

# Bash - Demo workflows
./run-all.sh demo
```

---

## Command Reference

### 🚀 Main Commands

```bash
# Fastest setup
make full

# Just run the server
make run

# Test everything
make test

# See what's available
make help

# Clean up
make stop
make clean  # Also removes node_modules
```

### 📊 Testing Commands

```bash
make test              # All tests
make test:unit         # Unit tests only
make test:integration  # Integration tests only
make test:pq          # PQ cryptography tests
make test:load        # Load tests (stress test)
```

### 🔧 Development Commands

```bash
make dev        # Watch mode (auto-reload on changes)
make lint       # Fix code style
make verify-pq  # Verify WASM module
```

### 🐳 Docker Commands

```bash
make docker           # Start IPFS + Redis
make docker:ps        # Show running containers
make docker:logs      # View all service logs
make docker:ipfs-logs # IPFS logs only
make docker:redis-logs # Redis logs only
make stop             # Stop services
```

### 📋 Logging & Information

```bash
make logs      # View recent execution log
make ps        # Show running services
make env       # Show .env configuration
make status    # System info (Node, Docker, etc.)
make clean     # Remove containers, logs, node_modules
```

---

## Workflows

### Workflow 1: Complete Setup (First Time)

```bash
# Windows
.\run-all.ps1 -Mode full
# Takes ~2-5 minutes

# Linux/macOS
./run-all.sh full
# Takes ~2-5 minutes

# OR
make full
```

**What happens:**
1. ✓ Checks Node.js, npm, Docker
2. ✓ Creates `.env` with defaults
3. ✓ Installs npm packages
4. ✓ Verifies WASM module
5. ✓ Starts IPFS & Redis
6. ✓ Runs unit tests
7. ✓ Runs integration tests
8. ✓ Runs PQ tests
9. ✓ Runs load tests
10. ✓ Generates report in `logs/`

---

### Workflow 2: Development Setup

```bash
# Quick setup without full testing
make setup

# Start development server
make dev

# Keep another terminal for testing
make test
```

**What's included:**
- ✓ Dependencies installed
- ✓ WASM module verified
- ✓ Docker services running
- ✓ Server with auto-reload

---

### Workflow 3: Run Tests & Validation

```bash
# Run all tests
make test

# Run specific tests
make test:unit
make test:integration
make test:pq
make test:load
```

**Test Summary:**
- **Unit Tests**: Fast validation of individual functions
- **Integration Tests**: Verify IPFS, Redis, PQ together
- **PQ Tests**: Cryptographic operations validation
- **Load Tests**: Stress test with many concurrent requests

---

### Workflow 4: Feature Demonstration

```bash
# See all features in action
make demo

# Output shows:
# ✓ Storing credential with ML-DSA-65
# ✓ Retrieving with verification
# ✓ Verifying signature manually
# ✓ Exporting ZKP proof
# ✓ All responses with actual CIDs
```

---

### Workflow 5: API Testing

Once server is running (`make run`), use another terminal:

```bash
# Store a credential
curl -X POST http://localhost:3000/api/v1/store \
  -H "Content-Type: application/json" \
  -d '{
    "claims": {"name": "Alice", "degree": "BS"},
    "metadata": {"issuer": "MIT"},
    "did": "did:example:issuer-001",
    "privateKey": "test-key-base64"
  }'

# Retrieve credential (replace BAFY... with actual CID)
curl http://localhost:3000/api/v1/retrieve/bafy...

# Verify signature
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "cid": "bafy...",
    "publicKey": "test-public-key-base64"
  }'

# Export ZKP
curl http://localhost:3000/api/v1/export-zkp/bafy...

# Health check
curl http://localhost:3000/health

# Prometheus metrics
curl http://localhost:3000/metrics
```

---

## Available Endpoints

Once server is running:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/store` | Store credential with PQ signature |
| GET | `/api/v1/retrieve/{cid}` | Retrieve & verify credential |
| POST | `/api/v1/verify` | Manually verify signature |
| GET | `/api/v1/export-zkp/{cid}` | Export zero-knowledge proof |
| GET | `/api/v1/retrieve-batch?cids=...` | Batch retrieve credentials |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

---

## Services & Ports

Services started automatically:

| Service | Port | URL |
|---------|------|-----|
| API Server | 3000 | http://localhost:3000 |
| IPFS API | 5001 | http://localhost:5001 |
| IPFS Gateway | 8080 | http://localhost:8080 |
| Redis | 6379 | redis://localhost:6379 |
| Prometheus | 9090 | http://localhost:9090 |
| Grafana | 3001 | http://localhost:3001 |

---

## Logs & Reports

### Execution Logs

After running any workflow, check logs in:

```
📁 logs/
├── execution_2026-04-16_14-30-45.log    (timestamp logs)
└── report_2026-04-16_14-30-45.txt       (summary report)
```

View recent log:

```bash
make logs

# OR
tail -50 logs/execution_*.log
```

### Understanding Log Levels

```
[HH:MM:SS] [SUCCESS] ✓ Operation completed
[HH:MM:SS] [ERROR]   ✗ Operation failed
[HH:MM:SS] [WARNING] ⚠ Something to check
[HH:MM:SS] [DEBUG]   → Internal information
```

---

## Troubleshooting

### Problem: "Docker daemon is not running"

```bash
# Solution: Start Docker Desktop (Windows/macOS) or daemon (Linux)
sudo systemctl start docker  # Linux
open -a Docker              # macOS
# Windows: Click Docker Desktop in taskbar
```

### Problem: "Port 3000 already in use"

```bash
# Kill process on port 3000
# Windows (PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force

# Linux/macOS
lsof -ti:3000 | xargs kill -9
```

### Problem: "IPFS connection failed"

```bash
# Check IPFS logs
make docker:ipfs-logs

# Restart services
make stop
make docker
```

### Problem: "WASM module verification failed"

```bash
# Check for qsdid-wasm package
ls ../qsdid-wasm/pkg 2>/dev/null && echo "WASM found" || echo "WASM missing"

# Solution: Check symlink in package.json
npm ls qsdid-wasm
```

### Problem: "Tests timeout"

Increase timeout:

```bash
# In test command
npm run test:integration -- --testTimeout=120000

# Or in Makefile
test\:integration:
    npm run test:integration -- --testTimeout=120000
```

### Problem: "Permission denied" on Linux/macOS

```bash
# Make scripts executable
chmod +x run-all.sh

# For Makefile
chmod +x Makefile
```

### Problem: "node_modules corrupted"

```bash
# Clean reinstall
make clean
npm install
```

---

## Performance Tips

### For Fast Development

```bash
# Skip full tests during development
make run

# In another terminal
make test:unit  # Only quick tests

# For debugging
make dev        # Auto-reload on changes
```

### For Production Validation

```bash
# Run complete test suite
make full

# After passing
docker-compose -f docker-compose.prod.yml up -d
```

### Load Testing

```bash
# Monitor load test results
make test:load

# Check metrics while running
curl http://localhost:9090/api/v1/query?query=node_memory_usage_bytes
```

---

## Environment Configuration

Default `.env` created by scripts:

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# IPFS
IPFS_PRIMARY_URL=http://localhost:5001

# Redis
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_MODE=zkp_ready
STRICT_VERIFICATION=true

# PQC
PQC_ALGORITHM=ML-DSA-65
WASM_TIMEOUT=10000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_BATCH_OPERATIONS=true
ENABLE_EXPORT_ZKP=true
ENABLE_AUDIT_LOGS=true
```

Modify `.env` to customize behavior:

```bash
# Enable detailed logging
LOG_LEVEL=debug

# Increase rate limits
RATE_LIMIT_MAX_REQUESTS=1000

# Change IPFS endpoint
IPFS_PRIMARY_URL=http://custom-ipfs:5001
```

---

## Next Steps

### ✅ Completed Setup

```bash
# 1. Server is running
make run

# 2. Try API
curl http://localhost:3000/health

# 3. Store a credential
# (see API examples above)

# 4. Check monitoring
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001
```

### 📚 Documentation

- See [README-v2-PQ.md](README-v2-PQ.md) for detailed architecture
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for what's included
- See [examples/](examples/) for working code examples

### 🔗 Technologies Used

- **Node.js** + **Express.js** - API server
- **Kubo IPFS v0.39** - Decentralized storage
- **Redis** - Caching & queuing
- **WASM** - Post-quantum cryptography (ML-DSA-65)
- **Prometheus** + **Grafana** - Monitoring
- **Docker Compose** - Container orchestration

---

## Support

For issues or questions:

1. Check logs: `make logs`
2. Verify services: `make ps`
3. Check status: `make status`
4. Review documentation: `README-v2-PQ.md`
5. Check examples: `examples/pq-workflow.js`

---

**Created with ❤️ for secure, decentralized credential storage**

Last Updated: April 16, 2026
