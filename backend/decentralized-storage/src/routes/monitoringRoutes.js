// src/routes/monitoringRoutes.js
// Additional monitoring endpoints for DLQ, circuit breaker, and queue status.

import { Router } from 'express';
import { getCircuitBreakerStatus, queueLength } from '../provider/cidQueue.js';
import { getDLQEntries, getDLQSize, getRetryQueueSize } from '../provider/deadLetterQueue.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/v1/dlq-status — DLQ monitoring
router.get('/dlq-status', async (_req, res) => {
  try {
    const dlqSize = await getDLQSize();
    const retryQueueSize = await getRetryQueueSize();
    const mainQueueSize = await queueLength();
    const circuitBreaker = getCircuitBreakerStatus();

    return res.json({
      queues: {
        main: mainQueueSize,
        retry: retryQueueSize,
        dlq: dlqSize,
      },
      circuitBreaker,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[monitoring/dlq-status] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/dlq-entries — Inspect DLQ entries (max 100)
router.get('/dlq-entries', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const entries = await getDLQEntries(limit);

    return res.json({
      count: entries.length,
      entries,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[monitoring/dlq-entries] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/circuit-breaker — Circuit breaker status
router.get('/circuit-breaker', async (_req, res) => {
  try {
    const status = getCircuitBreakerStatus();
    const states = { 0: 'CLOSED', 1: 'OPEN', 2: 'HALF_OPEN' };

    return res.json({
      ...status,
      stateName: states[status.stateCode] || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[monitoring/circuit-breaker] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
