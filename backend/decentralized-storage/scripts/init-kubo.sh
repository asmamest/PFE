#!/usr/bin/env bash
# scripts/init-kubo.sh
# ------------------------------------------------------------
# Bootstrap a Kubo v0.39 node with settings optimised for:
#   - Large-scale CID storage (100M+ CIDs)
#   - Provide Sweep (batch DHT announcements)
#   - Prometheus metrics exposure
# Run once after `ipfs init` to apply the configuration.
# ------------------------------------------------------------
set -euo pipefail

STORAGE_MAX="${IPFS_STORAGE_MAX:-500GB}"
ROUTING_TYPE="${IPFS_ROUTING_TYPE:-dht}"

echo "► Configuring Kubo v0.39 for QSDID decentralized storage..."

# ── Storage ───────────────────────────────────────────────────
ipfs config Datastore.StorageMax "$STORAGE_MAX"

# ── Routing ───────────────────────────────────────────────────
# Use public DHT so any Kubo node can discover CIDs.
ipfs config Routing.Type "$ROUTING_TYPE"

# ── Reprovider ────────────────────────────────────────────────
# Disable the built-in periodic reprovider – we manage sweeps via
# the storage-manager's Provide Sweep worker (batch API calls).
ipfs config Reprovider.Interval "0"
ipfs config Reprovider.Strategy "all"

# ── Provide Sweep (Kubo v0.39 native) ────────────────────────
# Provide Sweep is ON by default in v0.39. These settings fine-tune it.
# ProviderQueue.Workers: number of concurrent DHT provide goroutines.
ipfs config --json Experimental.ProvideQueue '{"Workers":8}'

# ── API – allow Prometheus scraping ──────────────────────────
# Expose /metrics on the API port (default :5001).
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT","POST","GET"]'

# Enable detailed metrics (available from /debug/metrics/prometheus)
ipfs config --json Metrics.Debug true

# ── Gateway ───────────────────────────────────────────────────
# Read-only gateway – never used to push credentials.
ipfs config --json Gateway.PublicGateways '{}'
ipfs config --json Gateway.NoFetch false

# ── Listen addresses ─────────────────────────────────────────
ipfs config --json Addresses.Swarm '[
  "/ip4/0.0.0.0/tcp/4001",
  "/ip6/::/tcp/4001",
  "/ip4/0.0.0.0/udp/4001/quic-v1",
  "/ip6/::/udp/4001/quic-v1"
]'

# ── UPnP (auto NAT traversal – v0.39 recovery fix) ───────────
ipfs config --json Swarm.EnableAutoNATService true

# ── Connection manager ────────────────────────────────────────
ipfs config --json Swarm.ConnMgr '{
  "Type": "basic",
  "LowWater": 100,
  "HighWater": 400,
  "GracePeriod": "20s"
}'

echo "✔ Kubo configuration applied."
echo "  StorageMax   : $STORAGE_MAX"
echo "  Routing      : $ROUTING_TYPE"
echo "  Reprovider   : disabled (Provide Sweep worker handles this)"
echo ""
echo "Start the daemon with: ipfs daemon --enable-gc"
