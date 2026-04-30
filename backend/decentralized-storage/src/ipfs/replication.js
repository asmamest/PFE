// src/ipfs/replication.js
// Replicate CIDs across 3 IPFS nodes for redundancy.
// Background execution - doesn't block the main request.

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';

// Configure the 3 IPFS nodes from environment
const IPFS_NODES = [
  process.env.IPFS_NODE_1 || 'http://localhost:5001',
  process.env.IPFS_NODE_2 || 'http://node2:5001',
  process.env.IPFS_NODE_3 || 'http://node3:5001',
];

const PIN_TIMEOUT_MS = 30000;    // 30 seconds per node
const MAX_RETRIES_PER_NODE = 2;
const RETRY_DELAY_MS = 1000;     // 1 second between retries

/**
 * Attempt to pin a CID on a specific IPFS node via HTTP API.
 * @param {string} nodeUrl
 * @param {string} cid
 * @param {number} retryCount
 * @returns {Promise<{ok: boolean, nodeUrl: string, duration: number, error?: string}>}
 */
async function pinOnNode(nodeUrl, cid, retryCount = 0) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PIN_TIMEOUT_MS);

    const pinUrl = `${nodeUrl}/api/v0/pin/add?arg=${encodeURIComponent(cid)}&progress=false`;

    const response = await fetch(pinUrl, {
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const duration = Date.now() - start;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if pin was successful
    if (data.Pins && data.Pins.length > 0) {
      logger.info(`[replication] ✓ CID ${cid} pinned on ${nodeUrl} (${duration}ms)`);
      metrics.recordIpfsPinDuration(duration / 1000);
      return { ok: true, nodeUrl, duration };
    } else {
      throw new Error('No pins returned');
    }
  } catch (err) {
    const duration = Date.now() - start;
    const willRetry = retryCount < MAX_RETRIES_PER_NODE;

    if (willRetry) {
      logger.warn(
        `[replication] ✗ Failed to pin CID ${cid} on ${nodeUrl}: ${err.message} (retry ${retryCount + 1}/${MAX_RETRIES_PER_NODE})`
      );
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return pinOnNode(nodeUrl, cid, retryCount + 1);
    }

    logger.error(
      `[replication] ✗ Failed to pin CID ${cid} on ${nodeUrl} after ${MAX_RETRIES_PER_NODE} retries: ${err.message}`
    );

    return { ok: false, nodeUrl, duration, error: err.message };
  }
}

/**
 * Replicate a CID to all 3 configured IPFS nodes (background execution).
 * Doesn't block the main store request.
 *
 * @param {string} cid
 * @returns {Promise<{replicated: number, succeeded: number, failed: number}>}
 */
export async function replicateToAllNodes(cid) {
  logger.info(`[replication] Starting replication of CID ${cid} to ${IPFS_NODES.length} nodes`);

  const results = await Promise.allSettled(
    IPFS_NODES.map((nodeUrl) => pinOnNode(nodeUrl, cid))
  );

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status === 'fulfilled' && result.value.ok) {
      succeeded += 1;
    } else {
      failed += 1;
      const error =
        result.status === 'rejected' ? result.reason : result.value?.error || 'Unknown error';
      logger.warn(
        `[replication] Replication failed for node ${i + 1}/${IPFS_NODES.length}: ${error}`
      );
    }
  }

  const replicationFactor = succeeded / IPFS_NODES.length;
  metrics.updateReplicationFactor(replicationFactor);

  logger.info(
    `[replication] Replication complete - Retrieved: ${cid}, ` +
    `Succeeded: ${succeeded}/${IPFS_NODES.length}, Replication Factor: ${replicationFactor.toFixed(2)}`
  );

  return {
    replicated: IPFS_NODES.length,
    succeeded,
    failed,
    replicationFactor,
    cid,
  };
}

/**
 * Async background replication (fire and forget).
 * Should be called after storing credential, but doesn't block the response.
 *
 * @param {string} cid
 */
export function startBackgroundReplication(cid) {
  // Execute without awaiting or blocking
  replicateToAllNodes(cid).catch((err) => {
    logger.error(`[replication] Background replication error for CID ${cid}: ${err.message}`);
  });
}

/**
 * Get detailed replication status for a CID (for monitoring).
 * @param {string} cid
 * @returns {Promise<{cid: string, nodes: []}>}
 */
export async function getReplicationStatus(cid) {
  const nodes = await Promise.all(
    IPFS_NODES.map(async (nodeUrl) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const pinUrl = `${nodeUrl}/api/v0/pin/ls?arg=${encodeURIComponent(cid)}`;
        const response = await fetch(pinUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          return { nodeUrl, pinned: true, type: data.PinType };
        }

        return { nodeUrl, pinned: false };
      } catch (err) {
        return { nodeUrl, pinned: false, error: err.message };
      }
    })
  );

  const pinnedCount = nodes.filter((n) => n.pinned).length;

  return {
    cid,
    nodes,
    pinnedCount,
    total: IPFS_NODES.length,
    replicationFactor: pinnedCount / IPFS_NODES.length,
  };
}
