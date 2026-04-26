// src/routes/healthRoutes.js
import { Router } from 'express';
import { getIpfsClient, getProvideStats } from '../ipfs/client.js';
import { queueLength, loadProvideState } from '../provider/cidQueue.js';
import { logger } from '../utils/logger.js';
import { performHealthCheck, getIpfsDetail } from '../health/healthCheck.js';

const router = Router();

// GET /health — Comprehensive health check (with timeout)
router.get('/health', async (_req, res) => {
  const health = await performHealthCheck();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'critical' ? 503 : 200;
  return res.status(statusCode).json(health);
});

// GET /health/ipfs — Detailed IPFS node status
router.get('/health/ipfs', async (_req, res) => {
  try {
    const detail = await getIpfsDetail();
    return res.json(detail);
  } catch (err) {
    logger.error(`[health/ipfs] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// GET /health/provide — Detailed provide stats from Kubo v0.39
router.get('/health/provide', async (_req, res) => {
  try {
    const ipfs = await getIpfsClient({ retries: 1, delayMs: 500 });
    const stats = await getProvideStats(ipfs);
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
