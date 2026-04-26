// src/metrics/prometheus.js
// Prometheus metrics registry for the QSDID storage-manager.
// Exposed on a dedicated port (default :9091) at /metrics.

import client from 'prom-client';
import express from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Use a custom registry to avoid polluting the default one in tests.
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'qsdid_' });

// ── Store metrics ─────────────────────────────────────────────
const storeTotal = new client.Counter({
  name: 'ipfs_store_total',
  help: 'Total number of credentials stored on IPFS',
  registers: [registry],
});

const storeDurationSeconds = new client.Histogram({
  name: 'ipfs_store_duration_seconds',
  help: 'Duration of a credential store operation in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// ── Retrieve metrics ──────────────────────────────────────────
const retrieveTotal = new client.Counter({
  name: 'ipfs_retrieve_total',
  help: 'Total number of credentials retrieved from IPFS',
  registers: [registry],
});

const retrieveDurationSeconds = new client.Histogram({
  name: 'ipfs_retrieve_duration_seconds',
  help: 'Duration of a credential retrieve operation in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

// ── Provide Sweep metrics ─────────────────────────────────────
const provideTotalCids = new client.Gauge({
  name: 'ipfs_provide_total_cids',
  help: 'Total number of CIDs announced to the DHT (from Kubo provide stats)',
  registers: [registry],
});

const provideLastSweepDuration = new client.Gauge({
  name: 'ipfs_provide_last_sweep_duration_seconds',
  help: 'Duration of the last Provide Sweep cycle in seconds',
  registers: [registry],
});

const provideErrorsTotal = new client.Counter({
  name: 'ipfs_provide_errors_total',
  help: 'Total number of errors during DHT provide/pin operations',
  registers: [registry],
});

const cidQueueDepth = new client.Gauge({
  name: 'ipfs_cid_queue_depth',
  help: 'Current number of CIDs pending DHT announcement',
  registers: [registry],
});

// ── Oracle metrics ─────────────────────────────────────────────
const oracleRequestsTotal = new client.Counter({
  name: 'qsdid_oracle_requests_total',
  help: 'Total number of verification requests processed',
  registers: [registry],
});

const oracleValidVerifications = new client.Counter({
  name: 'qsdid_oracle_valid_verifications_total',
  help: 'Total number of valid verifications',
  registers: [registry],
});

const oracleInvalidVerifications = new client.Counter({
  name: 'qsdid_oracle_invalid_verifications_total',
  help: 'Total number of invalid verifications',
  registers: [registry],
});

const oracleRequestDuration = new client.Histogram({
  name: 'qsdid_oracle_request_duration_seconds',
  help: 'Duration of verification requests',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

const oraclePendingRequests = new client.Gauge({
  name: 'qsdid_oracle_pending_requests',
  help: 'Number of pending verification requests',
  registers: [registry],
});

// ── Redis Queue metrics ────────────────────────────────────────
const redisQueueLength = new client.Gauge({
  name: 'redis_queue_length',
  help: 'Current number of items in the main Redis queue',
  registers: [registry],
});

const redisDlqLength = new client.Gauge({
  name: 'redis_dlq_length',
  help: 'Current number of items in the Dead Letter Queue',
  registers: [registry],
});

const redisRetryQueueLength = new client.Gauge({
  name: 'redis_retry_queue_length',
  help: 'Current number of items in the retry queue',
  registers: [registry],
});

// ── Signature Verification metrics ──────────────────────────────
const mlDsaVerificationFailures = new client.Counter({
  name: 'ml_dsa_verification_failures_total',
  help: 'Total number of failed ML-DSA-65 signature verifications',
  registers: [registry],
});

const mlDsaVerificationSuccesses = new client.Counter({
  name: 'ml_dsa_verification_successes_total',
  help: 'Total number of successful ML-DSA-65 signature verifications',
  registers: [registry],
});

// ── Decryption metrics ──────────────────────────────────────────
const credentialDecryptionErrors = new client.Counter({
  name: 'credential_decryption_errors_total',
  help: 'Total number of credential decryption errors (e.g., invalid GCM tag)',
  registers: [registry],
});

const credentialDecryptionSuccess = new client.Counter({
  name: 'credential_decryption_success_total',
  help: 'Total number of successful credential decryptions',
  registers: [registry],
});

// ── IPFS Replication metrics ────────────────────────────────────
const ipfsReplicationFactor = new client.Gauge({
  name: 'ipfs_replication_factor',
  help: 'Average number of node copies per CID',
  registers: [registry],
});

const ipfsPinDurationSeconds = new client.Histogram({
  name: 'ipfs_pin_duration_seconds',
  help: 'Duration of IPFS pin operations across all nodes',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

// ── Circuit Breaker metrics ────────────────────────────────────
const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  labelNames: ['service'],
  registers: [registry],
});

const circuitBreakerFailureCount = new client.Gauge({
  name: 'circuit_breaker_failure_count',
  help: 'Number of consecutive failures recorded by circuit breaker',
  labelNames: ['service'],
  registers: [registry],
});

const oracleHealth = new client.Gauge({
  name: 'qsdid_oracle_health',
  help: 'Oracle health status (1=healthy, 0=unhealthy)',
  registers: [registry],
});

export const metrics = {
  storeTotal,
  storeDurationSeconds,
  retrieveTotal,
  retrieveDurationSeconds,
  provideTotalCids,
  provideLastSweepDuration,
  provideErrorsTotal,
  cidQueueDepth,
  // Redis & DLQ
  redisQueueLength,
  redisDlqLength,
  redisRetryQueueLength,
  // Signature verification
  mlDsaVerificationFailures,
  mlDsaVerificationSuccesses,
  // Decryption
  credentialDecryptionErrors,
  credentialDecryptionSuccess,
  // IPFS Replication
  ipfsReplicationFactor,
  ipfsPinDurationSeconds,
  // Circuit Breaker
  circuitBreakerState,
  circuitBreakerFailureCount,
};

export const oracleMetrics = {
  oracleRequestsTotal,
  oracleValidVerifications,
  oracleInvalidVerifications,
  oracleRequestDuration,
  oraclePendingRequests,
  oracleHealth,
};

/**
 * Start the Prometheus scrape endpoint on the configured port.
 * Runs on a separate port (default :9091) to avoid conflicts with the main API.
 */
export function startMetricsServer() {
  if (!config.metrics.enabled) {
    logger.info('[metrics] Metrics disabled');
    return;
  }

  const app = express();

  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).end(err.message);
    }
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const metricsPort = config.metrics.prometheusPort || 9091;
  app.listen(metricsPort, () => {
    logger.info(`[metrics] Prometheus endpoint listening on :${metricsPort}/metrics`);
  });
}

/**
 * Update queue metrics (call periodically from sweep worker).
 */
export async function updateQueueMetrics(mainQueueLen, retryQueueLen, dlqLen) {
  redisQueueLength.set(mainQueueLen);
  redisRetryQueueLength.set(retryQueueLen);
  redisDlqLength.set(dlqLen);
}

/**
 * Update circuit breaker metrics (call when state changes).
 */
export function updateCircuitBreakerMetrics(serviceName, stateCode, failureCount) {
  circuitBreakerState.labels(serviceName).set(stateCode);
  circuitBreakerFailureCount.labels(serviceName).set(failureCount);
}

/**
 * Record IPFS pin duration.
 */
export function recordIpfsPinDuration(durationSeconds) {
  ipfsPinDurationSeconds.observe(durationSeconds);
}

/**
 * Update IPFS replication factor.
 */
export function updateReplicationFactor(factor) {
  ipfsReplicationFactor.set(factor);
}