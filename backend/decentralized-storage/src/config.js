// src/config.js
// Central typed configuration – all env vars resolved here once.
import 'dotenv/config';

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}

export const config = {
  // ── Service ──────────────────────────────────────────────────
  port: parseInt(optional('PORT', '3500'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  logLevel: optional('LOG_LEVEL', 'info'),

  // ── IPFS / Kubo ──────────────────────────────────────────────
  ipfs: {
    apiUrl: optional('IPFS_API_URL', 'http://127.0.0.1:5001'),
    gatewayUrl: optional('IPFS_GATEWAY_URL', 'http://127.0.0.1:8080'),
    storageMax: optional('IPFS_STORAGE_MAX', '500GB'),
    cidVersion: 1,         // always CIDv1 (base32)
    hashAlgo: 'sha2-256',  // blake3 not yet widely supported by all gateways
  },

  // ── Provide Sweep ─────────────────────────────────────────────
  sweep: {
    intervalMinutes: parseInt(optional('PROVIDE_SWEEP_INTERVAL_MINUTES', '10'), 10),
    batchSize: parseInt(optional('PROVIDE_SWEEP_BATCH_SIZE', '1000'), 10),
  },

  // ── Redis ─────────────────────────────────────────────────────
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
    cidQueueKey: optional('REDIS_CID_QUEUE_KEY', 'qsdid:cid-queue'),
    provideStateKey: optional('REDIS_PROVIDE_STATE_KEY', 'qsdid:provide-state'),
  },

  // ── Encryption ────────────────────────────────────────────────
  encryption: {
    // 64-char hex = 32 raw bytes master key for HKDF derivation
    masterKeyHex: optional(
      'MASTER_ENCRYPTION_KEY',
      '0'.repeat(64), // dev placeholder – override in production!
    ),
  },

  // ── Cluster (optional) ────────────────────────────────────────
  cluster: {
    enabled: optional('CLUSTER_ENABLED', 'false') === 'true',
    apiUrl: optional('CLUSTER_API_URL', 'http://127.0.0.1:9094'),
    replicationFactor: parseInt(optional('CLUSTER_REPLICATION_FACTOR', '2'), 10),
  },
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
    oraclePrivateKey: process.env.BLOCKCHAIN_ORACLE_PRIVATE_KEY,
    oracleAddress: process.env.BLOCKCHAIN_ORACLE_ADDRESS,
    oracleContractAddress: process.env.BLOCKCHAIN_ORACLE_CONTRACT_ADDRESS,
    registryContractAddress: process.env.BLOCKCHAIN_REGISTRY_CONTRACT_ADDRESS,
    pollingInterval: parseInt(process.env.BLOCKCHAIN_POLLING_INTERVAL) || 5000,
    batchSize: parseInt(process.env.BLOCKCHAIN_BATCH_SIZE) || 10,
    maxRetries: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES) || 3,
    enableOracle: process.env.BLOCKCHAIN_ENABLE_ORACLE === 'true'
  },

  // ── Metrics ───────────────────────────────────────────────────
  metrics: {
    enabled: optional('METRICS_ENABLED', 'true') === 'true',
    prometheusPort: parseInt(optional('PROMETHEUS_PORT', '9091'), 10),
  },
};
