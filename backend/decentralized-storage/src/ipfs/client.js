// src/ipfs/client.js
// Thin wrapper around kubo-rpc-client with retry-on-startup logic.
import { create } from 'kubo-rpc-client';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let _client = null;

/**
 * Returns a singleton kubo-rpc-client instance.
 * Retries connection until Kubo is ready (useful on container start-up).
 */
export async function getIpfsClient({ retries = 10, delayMs = 3000 } = {}) {
  if (_client) return _client;

  const url = new URL(config.ipfs.apiUrl);
  const client = create({ url });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const id = await client.id();
      logger.info(`Connected to IPFS node`, {
        peerId: id.id.toString(),
        agentVersion: id.agentVersion,
      });
      _client = client;
      return _client;
    } catch (err) {
      logger.warn(`IPFS not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw new Error('Could not connect to IPFS daemon after retries.');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Return basic node stats and provide stats from Kubo v0.39+.
 * `ipfs provide stat` is exposed via POST /api/v0/stats/provide
 */
export async function getProvideStats(client) {
  try {
    // kubo-rpc-client does not yet have a typed helper for `stats/provide`,
    // so we use the low-level fetch wrapper.
    const res = await client.fetch('/api/v0/stats/provide', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    logger.warn(`Could not fetch provide stats: ${err.message}`);
    return null;
  }
}

/**
 * Trigger a reprovide sweep via the Kubo HTTP API.
 * Kubo v0.39 groups DHT announcements (Provide Sweep) automatically.
 */
export async function triggerReprovide(client) {
  try {
    const res = await client.fetch('/api/v0/bitswap/reprovide', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info('Reprovide sweep triggered successfully');
    return true;
  } catch (err) {
    logger.error(`Reprovide sweep failed: ${err.message}`);
    return false;
  }
}
