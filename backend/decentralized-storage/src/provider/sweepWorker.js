// src/provider/sweepWorker.js
// Provide Sweep Worker — periodically drains the CID queue and
// triggers Kubo's batch reprovide (Provide Sweep, default in v0.39).
//
// Two triggers:
//   1. Interval-based  : every PROVIDE_SWEEP_INTERVAL_MINUTES
//   2. Size-based      : whenever queue length >= PROVIDE_SWEEP_BATCH_SIZE

import cron from 'node-cron';
import { getIpfsClient, triggerReprovide, getProvideStats } from '../ipfs/client.js';
import { dequeueCids, queueLength, saveProvideState, loadProvideState } from './cidQueue.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';
import { config } from '../config.js';

let _running = false;

/**
 * Execute a single provide-sweep cycle.
 *
 * Strategy:
 *  1. Dequeue up to BATCH_SIZE CIDs from Redis.
 *  2. Pin each CID via ipfs.pin.add (ensures node has the data).
 *  3. Trigger ipfs reprovide (Kubo v0.39 Provide Sweep: batches DHT announces).
 *  4. Persist state for restart-recovery.
 *  5. Update Prometheus metrics.
 */
export async function runSweepCycle() {
  if (_running) {
    logger.debug('[sweep] Cycle already running, skipping.');
    return;
  }
  _running = true;
  const start = Date.now();
  let cidsAnnounced = 0;
  let errors = 0;

  try {
    const batchSize = config.sweep.batchSize;
    const ipfs = await getIpfsClient();

    // ── Drain the queue ──────────────────────────────────────
    const cids = await dequeueCids(batchSize);
    if (cids.length === 0) {
      logger.debug('[sweep] Queue empty, nothing to provide.');
      return;
    }

    logger.info(`[sweep] Providing ${cids.length} CIDs...`);

    // ── Ensure CIDs are pinned locally ───────────────────────
    // (they should already be pinned from storeCredential, but belt & braces)
    for (const cid of cids) {
      try {
        await ipfs.pin.add(cid, { recursive: true });
        cidsAnnounced++;
      } catch (err) {
        logger.warn(`[sweep] Pin failed for ${cid}: ${err.message}`);
        errors++;
        metrics.provideErrorsTotal.inc();
      }
    }

    // ── Trigger Provide Sweep (Kubo v0.39 batch reprovide) ───
    // Kubo's Provide Sweep internally groups all pinned CIDs and
    // announces them to the DHT peers efficiently.
    await triggerReprovide(ipfs);

    // ── Collect provide stats ────────────────────────────────
    const stats = await getProvideStats(ipfs);
    if (stats) {
      logger.info('[sweep] Provide stats', stats);
      if (typeof stats.TotalProvided === 'number') {
        metrics.provideTotalCids.set(stats.TotalProvided);
      }
    }

    // ── Persist sweep state ──────────────────────────────────
    const state = {
      lastSweep: new Date().toISOString(),
      cidsAnnounced: (await loadProvideState())?.cidsAnnounced ?? 0 + cidsAnnounced,
      errors,
    };
    await saveProvideState(state);

    // ── Prometheus ───────────────────────────────────────────
    const durationSec = (Date.now() - start) / 1000;
    metrics.provideLastSweepDuration.set(durationSec);
    logger.info(`[sweep] Cycle complete in ${durationSec.toFixed(2)}s — announced ${cidsAnnounced} CIDs`);

  } catch (err) {
    logger.error(`[sweep] Cycle failed: ${err.message}`);
    metrics.provideErrorsTotal.inc();
  } finally {
    _running = false;
  }
}

/**
 * Watch the queue and trigger a sweep if the batch-size threshold is crossed.
 * Runs every 30 seconds to check queue depth.
 */
async function watchQueueDepth() {
  const len = await queueLength();
  if (len >= config.sweep.batchSize) {
    logger.info(`[sweep] Queue size ${len} >= batch size ${config.sweep.batchSize}, triggering early sweep.`);
    await runSweepCycle();
  }
}

/**
 * Start the Provide Sweep background worker.
 * Registers two cron jobs:
 *   - Full sweep every N minutes (from config).
 *   - Queue-depth check every 30 s.
 */
export function startSweepWorker() {
  const intervalMin = config.sweep.intervalMinutes;
  const cronExpr = `*/${intervalMin} * * * *`;

  logger.info(`[sweep] Starting Provide Sweep worker (interval=${intervalMin}m, batch=${config.sweep.batchSize})`);

  // Periodic sweep
  cron.schedule(cronExpr, async () => {
    await runSweepCycle();
  });

  // Queue-depth watcher (every 30 s)
  cron.schedule('*/30 * * * * *', async () => {
    await watchQueueDepth();
  });

  // Run once at startup to clear anything enqueued before the last restart.
  setImmediate(async () => {
    const prev = await loadProvideState();
    if (prev) {
      logger.info('[sweep] Resuming from previous state', prev);
    }
    await runSweepCycle();
  });
}
