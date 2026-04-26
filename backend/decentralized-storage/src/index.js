// src/index.js — Main entry point for the QSDID storage-manager microservice.
import 'dotenv/config';
import express from 'express';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { getIpfsClient } from './ipfs/client.js';
import { startSweepWorker } from './provider/sweepWorker.js';
import { startRetryWorker, stopRetryWorker } from './provider/retryWorker.js';
import { startMetricsServer } from './metrics/prometheus.js';
import credentialRoutes from './routes/credentialRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import { closeRedis } from './provider/cidQueue.js';
import { startOracleService, stopOracleService } from './oracle/oracleService.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1', credentialRoutes);
app.use('/api/v1', monitoringRoutes);
app.use('/', healthRoutes);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ─────────────────────────────────────────────────
async function bootstrap() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(' QSDID Decentralized Storage Manager');
  logger.info(`  ENV  : ${config.nodeEnv}`);
  logger.info(`  PORT : ${config.port}`);
  logger.info(`  IPFS : ${config.ipfs.apiUrl}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Wait for IPFS node to be ready before accepting traffic.
  await getIpfsClient();

  // Start Provide Sweep background worker.
  startSweepWorker();

  // Start Dead Letter Queue retry worker.
  startRetryWorker();

  // Start Prometheus metrics scrape endpoint.
  startMetricsServer();

  // Démarrer l'oracle si configuré
  if (config.blockchain.enableOracle === 'true') {
    try {
      await startOracleService();
      logger.info('[oracle] Oracle service started');
    } catch (err) {
      logger.error(`[oracle] Failed to start oracle: ${err.message}`);
    }
  }

  // Start REST API server.
  const server = app.listen(config.port, () => {
    logger.info(`[api] Storage manager ready at http://0.0.0.0:${config.port}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────
  async function shutdown(signal) {
    logger.info(`[shutdown] ${signal} received — shutting down gracefully`);
    
    // Stop workers first
    stopRetryWorker();
    
    // Arrêter l'oracle
    await stopOracleService();
    
    server.close(async () => {
      await closeRedis();
      logger.info('[shutdown] Clean exit');
      process.exit(0);
    });
    // Force exit after 10 s
    setTimeout(() => process.exit(1), 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error(`Fatal bootstrap error: ${err.message}`);
  process.exit(1);
});