// src/provider/credentialIndex.js
// Redis-based credential index for pagination.
// Stores credentials per DID in a sorted set (score = timestamp).

import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const CREDENTIAL_INDEX_PREFIX = 'qsdid:credentials:';

/**
 * Get Redis instance
 */
function getRedis() {
  return new Redis(config.redis.url, {
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });
}

/**
 * Add a credential to the index for a specific DID.
 * @param {string} did
 * @param {string} cid
 * @param {number} timestamp (optional, uses current time if not provided)
 */
export async function indexCredential(did, cid, timestamp = Date.now()) {
  const redis = getRedis();

  try {
    const key = `${CREDENTIAL_INDEX_PREFIX}${did}`;
    // Add to sorted set with timestamp as score (for chronological ordering)
    await redis.zadd(key, timestamp, cid);
    
    // Set expiry to 1 year for safety
    await redis.expire(key, 365 * 24 * 60 * 60);
    
    logger.debug(`[credentialIndex] Indexed CID ${cid} for DID ${did}`);
  } finally {
    await redis.quit();
  }
}

/**
 * Get paginated credentials for a DID.
 * @param {string} did
 * @param {number} page (1-based)
 * @param {number} limit (max 100)
 * @returns {Promise<{credentials: [], page: number, limit: number, total: number, hasMore: boolean}>}
 */
export async function getPaginatedCredentials(did, page = 1, limit = 20) {
  const redis = getRedis();

  try {
    // Validate inputs
    const validLimit = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const validPage = Math.max(parseInt(page, 10), 1);
    const offset = (validPage - 1) * validLimit;

    const key = `${CREDENTIAL_INDEX_PREFIX}${did}`;

    // Get total count
    const total = await redis.zcard(key);

    if (total === 0) {
      return {
        credentials: [],
        page: validPage,
        limit: validLimit,
        total: 0,
        hasMore: false,
      };
    }

    // Get CIDs for this page (sorted DESC by timestamp = most recent first)
    const cids = await redis.zrevrange(key, offset, offset + validLimit - 1);

    // Get timestamps for each CID
    const credentials = [];
    for (const cid of cids) {
      const timestamp = await redis.zscore(key, cid);
      credentials.push({
        cid,
        indexedAt: new Date(parseInt(timestamp, 10)).toISOString(),
      });
    }

    const hasMore = offset + validLimit < total;

    return {
      credentials,
      page: validPage,
      limit: validLimit,
      total,
      hasMore,
    };
  } finally {
    await redis.quit();
  }
}

/**
 * Get total credential count for a DID.
 * @param {string} did
 * @returns {Promise<number>}
 */
export async function getCredentialCount(did) {
  const redis = getRedis();

  try {
    const key = `${CREDENTIAL_INDEX_PREFIX}${did}`;
    return await redis.zcard(key);
  } finally {
    await redis.quit();
  }
}

/**
 * Clear all credentials for a DID (be careful!).
 * @param {string} did
 */
export async function clearCredentialsForDid(did) {
  const redis = getRedis();

  try {
    const key = `${CREDENTIAL_INDEX_PREFIX}${did}`;
    const deleted = await redis.del(key);
    logger.warn(`[credentialIndex] Cleared ${deleted} credential entries for DID ${did}`);
    return deleted;
  } finally {
    await redis.quit();
  }
}

/**
 * Remove a specific credential from index.
 * @param {string} did
 * @param {string} cid
 */
export async function removeCredentialFromIndex(did, cid) {
  const redis = getRedis();

  try {
    const key = `${CREDENTIAL_INDEX_PREFIX}${did}`;
    const removed = await redis.zrem(key, cid);
    logger.debug(`[credentialIndex] Removed CID ${cid} from DID ${did} index (removed: ${removed})`);
    return removed;
  } finally {
    await redis.quit();
  }
}
