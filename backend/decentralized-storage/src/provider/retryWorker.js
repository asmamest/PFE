// src/provider/retryWorker.js
// Background worker that processes retries from DLQ with exponential backoff.
// Runs every 5 seconds to check for ready retries.

import cron from 'node-cron';
import { getReadyRetries, reEnqueueCid, clearRetryCounter } from './deadLetterQueue.js';
import { logger } from '../utils/logger.js';

let _retryWorkerTask = null;

/**
 * Start the retry worker (runs every 5 seconds).
 */
export function startRetryWorker() {
  if (_retryWorkerTask) {
    logger.warn('[retryWorker] Already running');
    return;
  }

  logger.info('[retryWorker] Started (check interval: 5s)');

  // Run every 5 seconds: 0 5 10 15 20 25 30 35 40 45 50 55 * * * *
  _retryWorkerTask = cron.schedule('*/5 * * * * *', async () => {
    try {
      const readyRetries = await getReadyRetries(50); // Process max 50 per run

      if (readyRetries.length === 0) {
        return; // Nothing to do
      }

      logger.info(`[retryWorker] Processing ${readyRetries.length} ready retries`);

      for (const { cid, retryCount } of readyRetries) {
        try {
          await reEnqueueCid(cid);
          logger.debug(`[retryWorker] Re-enqueued CID ${cid} (attempt ${retryCount + 1})`);
        } catch (err) {
          logger.error(`[retryWorker] Failed to re-enqueue CID ${cid}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`[retryWorker] Error in retry check: ${err.message}`);
    }
  });
}

/**
 * Stop the retry worker.
 */
export function stopRetryWorker() {
  if (_retryWorkerTask) {
    _retryWorkerTask.stop();
    _retryWorkerTask = null;
    logger.info('[retryWorker] Stopped');
  }
}

/**
 * Check if retry worker is running.
 */
export function isRetryWorkerRunning() {
  return _retryWorkerTask !== null && !_retryWorkerTask?.stopped;
}
