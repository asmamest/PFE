// src/provider/cidQueue.js
// Redis-backed FIFO queue for CIDs awaiting DHT announcement.
// The Provide Sweep worker drains this queue in configurable batches.
// Includes circuit breaker & health checks.

import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from './circuitBreaker.js';

let _redis = null;
const _circuitBreaker = new CircuitBreaker({
  name: 'redis',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,
});

function getRedis() {
  if (!_redis) {
    _redis = new Redis(config.redis.url, {
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delayMs = Math.min(times * 100, 3000);
        return delayMs;
      },
    });
    
    _redis.on('error', (err) => {
      logger.error(`[redis] ${err.message}`);
      _circuitBreaker.recordFailure();
    });
    
    _redis.on('connect', () => {
      logger.info('[redis] Connected');
      _circuitBreaker.recordSuccess();
    });

    _redis.on('ready', () => {
      logger.info('[redis] Ready');
      _circuitBreaker.recordSuccess();
    });

    _redis.on('reconnecting', (info) => {
      logger.warn(`[redis] Reconnecting: attempt ${info.attempt}, delay ${info.delayMs}ms`);
    });
  }
  return _redis;
}

export function getCircuitBreakerStatus() {
  return _circuitBreaker.getStatus();
}

const QUEUE_KEY = config.redis.cidQueueKey;
const STATE_KEY = config.redis.provideStateKey;

/**
 * Add a CID to the pending-provide queue.
 * @param {string} cid
 * @returns {Promise<boolean>} true if enqueued, false if circuit open
 */
export async function enqueueCid(cid) {
  if (!_circuitBreaker.isAllowed()) {
    logger.warn(`[cidQueue] Circuit breaker OPEN, cannot enqueue CID ${cid}`);
    return false;
  }

  try {
    const redis = getRedis();
    await redis.rpush(QUEUE_KEY, cid);
    _circuitBreaker.recordSuccess();
    logger.debug(`[cidQueue] Enqueued CID ${cid}`);
    return true;
  } catch (err) {
    _circuitBreaker.recordFailure();
    logger.error(`[cidQueue] Failed to enqueue CID: ${err.message}`);
    throw err;
  }
}

/**
 * Dequeue up to `count` CIDs atomically using LPOP.
 * @param {number} count
 * @returns {Promise<string[]>}
 */
export async function dequeueCids(count) {
  if (!_circuitBreaker.isAllowed()) {
    logger.warn(`[cidQueue] Circuit breaker OPEN, cannot dequeue CIDs`);
    return [];
  }

  try {
    const redis = getRedis();
    const items = await redis.lpop(QUEUE_KEY, count);
    _circuitBreaker.recordSuccess();
    return items ?? [];
  } catch (err) {
    _circuitBreaker.recordFailure();
    logger.error(`[cidQueue] Failed to dequeue CIDs: ${err.message}`);
    throw err;
  }
}

/**
 * Return the current length of the pending queue (for health checks).
 */
export async function queueLength() {
  if (!_circuitBreaker.isAllowed()) {
    logger.warn(`[cidQueue] Circuit breaker OPEN, cannot check queue length`);
    return -1; // Indicate circuit is open
  }

  try {
    const redis = getRedis();
    const len = await redis.llen(QUEUE_KEY);
    _circuitBreaker.recordSuccess();
    return len;
  } catch (err) {
    _circuitBreaker.recordFailure();
    logger.error(`[cidQueue] Failed to get queue length: ${err.message}`);
    throw err;
  }
}

/**
 * Persist the last sweep completion timestamp and stats.
 * @param {{ lastSweep: string, cidsAnnounced: number, errors: number }} state
 */
export async function saveProvideState(state) {
  if (!_circuitBreaker.isAllowed()) {
    logger.warn(`[cidQueue] Circuit breaker OPEN, cannot save provide state`);
    return false;
  }

  try {
    const redis = getRedis();
    await redis.set(STATE_KEY, JSON.stringify(state));
    _circuitBreaker.recordSuccess();
    return true;
  } catch (err) {
    _circuitBreaker.recordFailure();
    logger.error(`[cidQueue] Failed to save provide state: ${err.message}`);
    throw err;
  }
}

/**
 * Load the last persisted provide state (survives node restarts).
 */
export async function loadProvideState() {
  if (!_circuitBreaker.isAllowed()) {
    logger.warn(`[cidQueue] Circuit breaker OPEN, cannot load provide state`);
    return null;
  }

  try {
    const redis = getRedis();
    const raw = await redis.get(STATE_KEY);
    _circuitBreaker.recordSuccess();
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    _circuitBreaker.recordFailure();
    logger.error(`[cidQueue] Failed to load provide state: ${err.message}`);
    throw err;
  }
}

/**
 * Gracefully close the Redis connection (used in tests / shutdown hooks).
 */
export async function closeRedis() {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
