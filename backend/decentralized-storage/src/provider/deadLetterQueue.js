// src/provider/deadLetterQueue.js
// Dead Letter Queue (DLQ) for failed CID announcements.
// Flow: queue → retry:queue (with backoff) → dlq (final failures)

import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const MAIN_QUEUE_KEY = config.redis.cidQueueKey;           // 'qsdid:cid-queue'
const RETRY_QUEUE_KEY = 'qsdid:retry-queue';
const DLQ_KEY = 'qsdid:dlq';
const RETRY_COUNTER_PREFIX = 'qsdid:retry-count:';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s backoff

/**
 * Get Redis instance (shared from cidQueue)
 */
function getRedis() {
  return new Redis(config.redis.url, {
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });
}

/**
 * Move a failed CID to retry queue with exponential backoff.
 * @param {string} cid
 * @param {number} retryCount (current attempt, 0-based)
 * @returns {Promise<{queued: boolean, nextRetryMs: number}>}
 */
export async function moveToRetryQueue(cid, retryCount = 0) {
  const redis = getRedis();

  try {
    if (retryCount >= MAX_RETRIES) {
      // Max retries exceeded → move to DLQ
      await redis.lpush(DLQ_KEY, JSON.stringify({ cid, failedAt: new Date().toISOString(), retryCount }));
      logger.error(`[DLQ] CID ${cid} exceeded max retries (${MAX_RETRIES}), moved to DLQ`);
      await redis.del(`${RETRY_COUNTER_PREFIX}${cid}`);
      return { queued: false, moved_to_dlq: true };
    }

    // Calculate backoff delay
    const delayMs = RETRY_DELAYS[retryCount];
    const scheduledTime = Date.now() + delayMs;

    // Store in sorted set with scheduled time as score
    await redis.zadd(RETRY_QUEUE_KEY, scheduledTime, cid);

    // Increment retry counter
    await redis.incr(`${RETRY_COUNTER_PREFIX}${cid}`);

    logger.info(
      `[DLQ] CID ${cid} retry ${retryCount + 1}/${MAX_RETRIES}, ` +
      `scheduled in ${delayMs}ms`
    );

    return { queued: true, retryCount: retryCount + 1, nextRetryMs: delayMs };
  } finally {
    await redis.quit();
  }
}

/**
 * Get CIDs from retry queue that are ready (scheduled time passed).
 * @param {number} maxCount
 * @returns {Promise<Array<{cid: string, retryCount: number}>>}
 */
export async function getReadyRetries(maxCount = 100) {
  const redis = getRedis();

  try {
    const now = Date.now();

    // Get all CIDs with score ≤ now
    const readyCids = await redis.zrangebyscore(RETRY_QUEUE_KEY, '-inf', now, 'LIMIT', 0, maxCount);

    if (readyCids.length === 0) {
      return [];
    }

    // Remove from retry queue
    await redis.zrem(RETRY_QUEUE_KEY, ...readyCids);

    // Get retry counts for each CID
    const retries = [];
    for (const cid of readyCids) {
      const countStr = await redis.get(`${RETRY_COUNTER_PREFIX}${cid}`);
      const retryCount = parseInt(countStr ?? '0', 10);
      retries.push({ cid, retryCount });
    }

    logger.debug(`[DLQ] Retrieved ${retries.length} ready retries`);
    return retries;
  } finally {
    await redis.quit();
  }
}

/**
 * Enqueue a CID back to main queue (for retry processing).
 * @param {string} cid
 */
export async function reEnqueueCid(cid) {
  const redis = getRedis();

  try {
    await redis.rpush(MAIN_QUEUE_KEY, cid);
    logger.debug(`[DLQ] Re-enqueued CID ${cid} to main queue`);
  } finally {
    await redis.quit();
  }
}

/**
 * Get all entries in DLQ (for monitoring/debugging).
 * @returns {Promise<Array>}
 */
export async function getDLQEntries(limit = 100) {
  const redis = getRedis();

  try {
    const entries = await redis.lrange(DLQ_KEY, 0, limit - 1);
    return entries.map((e) => {
      try {
        return JSON.parse(e);
      } catch {
        return { raw: e };
      }
    });
  } finally {
    await redis.quit();
  }
}

/**
 * Get DLQ size for monitoring.
 */
export async function getDLQSize() {
  const redis = getRedis();

  try {
    return await redis.llen(DLQ_KEY);
  } finally {
    await redis.quit();
  }
}

/**
 * Get retry queue size (for monitoring).
 */
export async function getRetryQueueSize() {
  const redis = getRedis();

  try {
    return await redis.zcard(RETRY_QUEUE_KEY);
  } finally {
    await redis.quit();
  }
}

/**
 * Clear a retry counter for a CID (call after successful processing).
 * @param {string} cid
 */
export async function clearRetryCounter(cid) {
  const redis = getRedis();

  try {
    await redis.del(`${RETRY_COUNTER_PREFIX}${cid}`);
  } finally {
    await redis.quit();
  }
}

/**
 * Remove an entry from DLQ (after manual review/fix).
 * @param {string} dlqEntry JSON string
 */
export async function removeDLQEntry(dlqEntry) {
  const redis = getRedis();

  try {
    await redis.lrem(DLQ_KEY, 1, dlqEntry);
    logger.info(`[DLQ] Removed entry from DLQ`);
  } finally {
    await redis.quit();
  }
}
