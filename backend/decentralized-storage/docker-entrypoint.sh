#!/usr/bin/env bash
# docker-entrypoint.sh
# Initialises the IPFS repo if not already done, then starts the service.
set -euo pipefail

IPFS_PATH="${IPFS_PATH:-/data/ipfs}"
export IPFS_PATH

# ── 0. Ensure IPFS_PATH directory exists ─────────────────────
mkdir -p "$IPFS_PATH"

# ── 1. Initialise repo on first run ──────────────────────────
if [ ! -f "$IPFS_PATH/config" ]; then
  echo "► Initialising IPFS repo at $IPFS_PATH ..."
  ipfs init --profile=server
  echo "► Applying QSDID Kubo configuration ..."
  bash /app/scripts/init-kubo.sh
fi

# ── 2. Start Kubo daemon in background ───────────────────────
echo "► Starting Kubo daemon ..."
ipfs daemon --enable-gc --migrate &
IPFS_PID=$!

# ── 3. Wait for IPFS API to be ready ────────────────────────
echo "► Waiting for IPFS API ..."
for i in $(seq 1 30); do
  if ipfs id > /dev/null 2>&1; then
    echo "✔ IPFS daemon ready"
    break
  fi
  sleep 2
done

# ── 4. Execute the main command (node src/index.js) ──────────
exec "$@"
