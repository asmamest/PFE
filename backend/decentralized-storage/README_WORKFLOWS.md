# 🚀 QSDID Decentralized Storage - Complete Workflow Executor

**Version:** 2.0  
**Status:** ✅ Production Ready  
**Date:** April 16, 2026

---

## ⚡ Quick Start (30 seconds)

### Windows (PowerShell)

```powershell
# 1. Make script executable
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 2. Run full workflow
.\run-all.ps1

# OR use Makefile
make full
```

### Linux/macOS (Bash)

```bash
# 1. Make script executable
chmod +x run-all.sh

# 2. Run full workflow
./run-all.sh full

# OR use Makefile
make full
```

### Interactive Mode (All Platforms)

```bash
# Interactive menu
node run-interactive.js

# OR make command
make help  # See all options
```

---

## 📋 What You'll Get

The complete execution pipeline includes:

✅ **Dependency Verification** - Node.js, npm, Docker  
✅ **Environment Setup** - Creates `.env`, installs packages  
✅ **Docker Services** - Starts IPFS + Redis automatically  
✅ **Test Suite** - Unit, integration, PQ cryptography, load tests  
✅ **API Server** - Ready on http://localhost:3000  
✅ **Workflow Demos** - See store/retrieve/verify/export in action  
✅ **Execution Report** - Detailed summary with endpoints  
✅ **Monitoring** - Prometheus metrics, Grafana dashboards  

---

## 🎯 Three Ways to Execute

### Option 1: PowerShell Script (Windows)

```powershell
# View all modes
.\run-all.ps1 -Mode full      # Complete workflow
.\run-all.ps1 -Mode test      # Tests only
.\run-all.ps1 -Mode run       # Server only
.\run-all.ps1 -Mode demo      # Demonstrations
.\run-all.ps1 -Mode docker    # Start services
.\run-all.ps1 -Mode stop      # Stop services

# With verbose output
.\run-all.ps1 -Mode setup -Verbose
```

### Option 2: Bash Script (Linux/macOS)

```bash
# View all modes
./run-all.sh full       # Complete workflow
./run-all.sh test       # Tests only
./run-all.sh run        # Server only
./run-all.sh demo       # Demonstrations
./run-all.sh docker     # Start services
./run-all.sh stop       # Stop services
```

### Option 3: Makefile (All Platforms)

```bash
make full             # Complete workflow
make setup            # Setup only
make test             # All tests
make run              # Server only
make demo             # Demonstrations
make docker           # Services only
make stop             # Stop services

# Specific tests
make test:unit
make test:integration
make test:pq
make test:load

# Development
make dev              # Auto-reload server
make lint             # Fix code style

# Information
make help             # Show all commands
make status           # System info
make logs             # View recent logs
make ps               # Running services
```

---

## 📂 Script Files

| File | Purpose | Platform |
|------|---------|----------|
| **run-all.ps1** | Main workflow executor | Windows (PowerShell) |
| **run-all.sh** | Main workflow executor | Linux/macOS (Bash) |
| **Makefile** | Command wrapper | All platforms |
| **run-interactive.js** | Interactive menu | All platforms (Node.js) |

---

## 🔄 Workflows Explained

### Full Workflow (Recommended First Time)

```bash
make full
```

**Steps:**
1. ✓ Verifies Node.js, npm, Docker installed
2. ✓ Creates `.env` configuration file
3. ✓ Installs npm dependencies
4. ✓ Verifies PQ cryptography module (WASM)
5. ✓ Starts IPFS and Redis (Docker)
6. ✓ Runs unit tests
7. ✓ Runs integration tests
8. ✓ Runs post-quantum cryptography tests
9. ✓ Runs load stress tests
10. ✓ Generates execution report
11. ✓ Stops services for cleanup

**Time:** ~5-10 minutes

---

### Development Workflow

```bash
# Terminal 1: Setup (one time)
make setup

# Terminal 1: Run server with auto-reload
make dev

# Terminal 2: Run tests while developing
make test:unit
make test:integration
```

**Best for:** Rapid development and debugging

---

### Quick Validation Workflow

```bash
# Start services
make docker

# In another terminal
make test

# When done
make stop
```

**Best for:** Quick testing without full setup

---

### API Server Only

```bash
make run
```

Then use API:

```bash
# Store credential
curl -X POST http://localhost:3000/api/v1/store \
  -H "Content-Type: application/json" \
  -d '{
    "claims": {"name": "Alice", "degree": "BS"},
    "metadata": {"issuer": "MIT"},
    "did": "did:example:issuer-001",
    "privateKey": "key-base64"
  }'

# View health
curl http://localhost:3000/health
```

---

## 📊 Available Endpoints

### Core Operations

```bash
# Store credential with ML-DSA-65 signature
POST /api/v1/store

# Retrieve credential with verification
GET /api/v1/retrieve/{cid}

# Verify signature manually
POST /api/v1/verify

# Export zero-knowledge proof
GET /api/v1/export-zkp/{cid}

# Batch retrieve
GET /api/v1/retrieve-batch?cids=...
```

### Monitoring

```bash
# Health check
GET /health

# Prometheus metrics
GET /metrics
```

---

## 🐳 Services & Ports

| Service | Port | URL |
|---------|------|-----|
| **API Server** | 3000 | http://localhost:3000 |
| **IPFS API** | 5001 | http://localhost:5001 |
| **IPFS Gateway** | 8080 | http://localhost:8080 |
| **Redis** | 6379 | redis://localhost:6379 |
| **Prometheus** | 9090 | http://localhost:9090 |
| **Grafana** | 3001 | http://localhost:3001 |

---

## 📋 Logs & Reports

After each execution:

```
📁 logs/
├── execution_2026-04-16_14-30-45.log   # Timestamped execution log
└── report_2026-04-16_14-30-45.txt      # Summary report
```

View logs:

```bash
# Latest logs
make logs

# OR manually
tail -50 logs/execution_*.log

# OR tail all Docker logs
make docker:logs
```

---

## 🔧 Configuration

Default `.env` is auto-created with these settings:

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000

# Services
IPFS_PRIMARY_URL=http://localhost:5001
REDIS_URL=redis://localhost:6379

# Security
STORAGE_MODE=zkp_ready
STRICT_VERIFICATION=true
PQC_ALGORITHM=ML-DSA-65

# Features
ENABLE_BATCH_OPERATIONS=true
ENABLE_EXPORT_ZKP=true
ENABLE_AUDIT_LOGS=true
```

Modify `.env` to customize. Scripts respect your settings.

---

## ❌ Troubleshooting

### Docker not running

```bash
# Windows/macOS
open -a Docker   # or click Docker Desktop in taskbar

# Linux
sudo systemctl start docker
```

### Port already in use

```bash
# Kill process on port (adjust as needed)
# Windows (PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force

# Linux/macOS
lsof -ti:3000 | xargs kill -9
```

### IPFS connection failed

```bash
# Check IPFS logs
make docker:ipfs-logs

# Restart
make stop
make docker
```

### Tests timeout

Increase timeout:

```bash
npm run test:integration -- --testTimeout=120000
```

---

## 🎓 Usage Examples

### Example 1: Complete First-Time Setup

```bash
# All-in-one command
make full

# Result: Everything working, report in logs/
```

### Example 2: Development Flow

```bash
# Terminal 1: Start services & server
make setup && make dev

# Terminal 2: Run tests as you code
make test:unit

# Terminal 3: Try APIs
curl http://localhost:3000/health
```

### Example 3: Production Validation

```bash
# Full test suite
make full

# If all pass: deployment ready ✓
```

### Example 4: Interactive Mode

```bash
# Menu-driven interface
node run-interactive.js

# Select workflow from menu (1-7)
```

---

## 📚 Documentation

- **[EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)** - Complete detailed guide
- **[README-v2-PQ.md](README-v2-PQ.md)** - Architecture & features
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What's included
- **[examples/pq-workflow.js](examples/pq-workflow.js)** - Working code example

---

## 📈 Features Covered

✅ **Post-Quantum Cryptography** - ML-DSA-65 signatures  
✅ **Decentralized Storage** - IPFS integration (Kubo v0.39)  
✅ **Credential Management** - Store, retrieve, verify  
✅ **Zero-Knowledge Proofs** - Export ZKP for privacy  
✅ **Batch Operations** - Retrieve multiple credentials  
✅ **Rate Limiting** - Protect API from overload  
✅ **Caching** - Redis for performance  
✅ **Monitoring** - Prometheus metrics  
✅ **Health Checks** - System status  
✅ **Audit Logs** - Track all operations  
✅ **Error Recovery** - Circuit breaker patterns  
✅ **Load Testing** - Stress test capabilities  

---

## ✅ Prerequisites

- **Node.js** ≥ 20.0.0 → [Download](https://nodejs.org)
- **Docker Desktop** → [Download](https://docker.com)
- **Git** (optional) → [Download](https://git-scm.com)

---

## 🚦 Next Steps

1. **Run full workflow**: `make full`
2. **Check logs**: `make logs`
3. **Try API**: `curl http://localhost:3000/health`
4. **Read docs**: [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)
5. **Explore examples**: See `examples/` directory

---

## 🆘 Need Help?

```bash
# View all available commands
make help

# Check system status
make status

# View logs
make logs

# See running services
make ps

# Check environment
make env
```

---

## 🎉 You're Ready!

Choose your starting point:

```bash
# Fast track (5 min)
make demo

# Complete setup (10 min)
make full

# Interactive mode
node run-interactive.js

# Manual control
make docker  &  make run
```

---

**Built with ❤️ for secure, decentralized credential storage**

*For detailed information, see [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)*
